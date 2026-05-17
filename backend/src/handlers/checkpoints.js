const { PutCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { docClient, ok, created, badRequest, unauthorized, serverError, requireAdmin } = require('./utils');

const TABLE = process.env.CHECKPOINTS_TABLE;

const createCheckpoint = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { id: eventId, stageId } = event.pathParameters;
    const body = JSON.parse(event.body || '{}');
    if (!body.name) return badRequest('Název kontrolního bodu je povinný');
    if (body.lat === undefined || body.lng === undefined) return badRequest('Souřadnice jsou povinné');

    const item = {
      id: uuidv4(),
      eventId,
      stageId,
      name: body.name,
      code: (body.code || '').toUpperCase(),
      type: body.type === 'PK' ? 'PK' : 'SPK',
      lat: parseFloat(body.lat),
      lng: parseFloat(body.lng),
      radius: parseInt(body.radius || 50),
      order: parseInt(body.order || 0),
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return created(item);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const listCheckpoints = async (event) => {
  try {
    const { id: eventId, stageId } = event.pathParameters;
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'stageId = :stageId',
      ExpressionAttributeValues: { ':stageId': stageId },
    }));
    const items = (result.Items || []).sort((a, b) => a.order - b.order);
    return ok(items);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const updateCheckpoint = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { checkpointId } = event.pathParameters;
    const body = JSON.parse(event.body || '{}');

    const names = {};
    const values = {};
    let expr = [];

    if (body.name !== undefined) { expr.push('#name = :name'); names['#name'] = 'name'; values[':name'] = body.name; }
    if (body.code !== undefined) { expr.push('code = :code'); values[':code'] = body.code.toUpperCase(); }
    if (body.lat !== undefined) { expr.push('lat = :lat'); values[':lat'] = parseFloat(body.lat); }
    if (body.lng !== undefined) { expr.push('lng = :lng'); values[':lng'] = parseFloat(body.lng); }
    if (body.radius !== undefined) { expr.push('radius = :radius'); values[':radius'] = parseInt(body.radius); }

    if (expr.length === 0) return badRequest('Žádná pole k aktualizaci');

    const params = {
      TableName: TABLE,
      Key: { id: checkpointId },
      UpdateExpression: 'SET ' + expr.join(', '),
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    };
    if (Object.keys(names).length > 0) params.ExpressionAttributeNames = names;

    const result = await docClient.send(new UpdateCommand(params));
    return ok(result.Attributes);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const deleteCheckpoint = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { checkpointId } = event.pathParameters;
    await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { id: checkpointId } }));
    return ok({ deleted: true });
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

module.exports = { createCheckpoint, listCheckpoints, updateCheckpoint, deleteCheckpoint };
