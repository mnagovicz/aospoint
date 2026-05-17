const { PutCommand, QueryCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { docClient, ok, created, badRequest, unauthorized, notFound, serverError, requireAdmin } = require('./utils');

const STAGES_TABLE = process.env.STAGES_TABLE;
const COMPETITORS_TABLE = process.env.COMPETITORS_TABLE;

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 6 }, () => SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]).join('');

const createStage = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { id: eventId } = event.pathParameters;
    const body = JSON.parse(event.body || '{}');
    if (!body.name) return badRequest('Název etapy je povinný');

    const stage = {
      id: uuidv4(),
      eventId,
      name: body.name,
      order: parseInt(body.order || 1),
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: STAGES_TABLE, Item: stage }));

    // Auto-generovat stageCode pro každého existujícího závodníka
    const compResult = await docClient.send(new QueryCommand({
      TableName: COMPETITORS_TABLE,
      IndexName: 'eventId-index',
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId },
    }));

    await Promise.all((compResult.Items || []).map(comp =>
      docClient.send(new UpdateCommand({
        TableName: COMPETITORS_TABLE,
        Key: { id: comp.id },
        UpdateExpression: 'SET stageCodes.#stageId = :code',
        ExpressionAttributeNames: { '#stageId': stage.id },
        ExpressionAttributeValues: { ':code': genCode() },
      })).catch(async () => {
        // stageCodes map neexistuje ještě — inicializovat
        await docClient.send(new UpdateCommand({
          TableName: COMPETITORS_TABLE,
          Key: { id: comp.id },
          UpdateExpression: 'SET stageCodes = :map',
          ExpressionAttributeValues: { ':map': { [stage.id]: genCode() } },
        }));
      })
    ));

    return created(stage);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const listStages = async (event) => {
  try {
    const { id: eventId } = event.pathParameters;
    const result = await docClient.send(new QueryCommand({
      TableName: STAGES_TABLE,
      IndexName: 'eventId-index',
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId },
    }));
    const items = (result.Items || []).sort((a, b) => a.order - b.order);
    return ok(items);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const updateStage = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { id: eventId, stageId } = event.pathParameters;
    const body = JSON.parse(event.body || '{}');

    // Při aktivaci — zkontrolovat že žádná jiná etapa není active
    if (body.status === 'active') {
      const all = await docClient.send(new QueryCommand({
        TableName: STAGES_TABLE,
        IndexName: 'eventId-index',
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: { ':eventId': eventId },
      }));
      const alreadyActive = (all.Items || []).find(s => s.status === 'active' && s.id !== stageId);
      if (alreadyActive) return badRequest(`Etapa "${alreadyActive.name}" je již aktivní. Nejdříve ji ukončete.`);
    }

    const expr = [];
    const names = {};
    const values = {};

    if (body.name !== undefined) { expr.push('#name = :name'); names['#name'] = 'name'; values[':name'] = body.name; }
    if (body.order !== undefined) { expr.push('#order = :order'); names['#order'] = 'order'; values[':order'] = parseInt(body.order); }
    if (body.status !== undefined) { expr.push('#status = :status'); names['#status'] = 'status'; values[':status'] = body.status; }

    if (expr.length === 0) return badRequest('Žádná pole k aktualizaci');

    const params = {
      TableName: STAGES_TABLE,
      Key: { id: stageId },
      UpdateExpression: 'SET ' + expr.join(', '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    };

    const result = await docClient.send(new UpdateCommand(params));
    return ok(result.Attributes);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const deleteStage = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { stageId } = event.pathParameters;
    await docClient.send(new DeleteCommand({ TableName: STAGES_TABLE, Key: { id: stageId } }));
    return ok({ deleted: true });
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

module.exports = { createStage, listStages, updateStage, deleteStage };
