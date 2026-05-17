const { PutCommand, QueryCommand, GetCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { docClient, ok, created, badRequest, unauthorized, notFound, serverError, getCompetitorCode } = require('./utils');

const PASSAGES_TABLE = process.env.PASSAGES_TABLE;
const CHECKPOINTS_TABLE = process.env.CHECKPOINTS_TABLE;
const COMPETITORS_TABLE = process.env.COMPETITORS_TABLE;

const recordPassage = async (event) => {
  try {
    const competitorCode = getCompetitorCode(event);
    const body = JSON.parse(event.body || '{}');
    if (!body.competitorId) return badRequest('competitorId je povinný');
    if (!body.checkpointId) return badRequest('checkpointId je povinný');
    if (!body.stageId) return badRequest('stageId je povinný');
    if (!body.action || !['recorded', 'ignored'].includes(body.action)) {
      return badRequest('action musí být "recorded" nebo "ignored"');
    }

    // Ověřit závodníka a kód
    const compResult = await docClient.send(new GetCommand({
      TableName: COMPETITORS_TABLE,
      Key: { id: body.competitorId },
    }));
    if (!compResult.Item) return notFound('Závodník nenalezen');

    // Ověřit kód pro danou etapu
    const expectedCode = compResult.Item.stageCodes?.[body.stageId];
    if (competitorCode && expectedCode && expectedCode !== competitorCode) {
      return unauthorized('Neplatný kód závodníka pro tuto etapu');
    }

    const existingResult = await docClient.send(new ScanCommand({
      TableName: PASSAGES_TABLE,
      FilterExpression: 'competitorId = :cid AND checkpointId = :cpid AND stageId = :sid',
      ExpressionAttributeValues: {
        ':cid': body.competitorId,
        ':cpid': body.checkpointId,
        ':sid': body.stageId,
      },
      Select: 'COUNT',
    }));
    const passageNumber = (existingResult.Count || 0) + 1;

    const item = {
      id: uuidv4(),
      competitorId: body.competitorId,
      checkpointId: body.checkpointId,
      stageId: body.stageId,
      eventId: compResult.Item.eventId,
      action: body.action,
      timestamp: body.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      passageNumber,
    };

    await docClient.send(new PutCommand({ TableName: PASSAGES_TABLE, Item: item }));
    return created(item);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const listPassages = async (event) => {
  try {
    const { id: eventId } = event.pathParameters;
    const result = await docClient.send(new ScanCommand({
      TableName: PASSAGES_TABLE,
      FilterExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId },
    }));
    return ok(result.Items || []);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const getResults = async (event) => {
  try {
    const { id: eventId, stageId } = event.pathParameters;

    const [cpResult, compResult, passResult] = await Promise.all([
      docClient.send(new ScanCommand({
        TableName: CHECKPOINTS_TABLE,
        FilterExpression: 'stageId = :sid',
        ExpressionAttributeValues: { ':sid': stageId },
      })),
      docClient.send(new QueryCommand({
        TableName: COMPETITORS_TABLE,
        IndexName: 'eventId-index',
        KeyConditionExpression: 'eventId = :eid',
        ExpressionAttributeValues: { ':eid': eventId },
      })),
      docClient.send(new ScanCommand({
        TableName: PASSAGES_TABLE,
        FilterExpression: 'stageId = :sid',
        ExpressionAttributeValues: { ':sid': stageId },
      })),
    ]);

    const checkpoints = (cpResult.Items || []).sort((a, b) => a.order - b.order);
    const competitors = compResult.Items || [];
    const passages = passResult.Items || [];

    const results = competitors.map(comp => {
      const compPassages = passages
        .filter(p => p.competitorId === comp.id)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const recorded = compPassages.filter(p => p.action === 'recorded');

      return {
        competitor: {
          id: comp.id,
          name: comp.name,
          driver: comp.driver,
          coDriver: comp.coDriver,
          number: comp.number,
          vehicle: comp.vehicle,
        },
        totalCheckpoints: checkpoints.length,
        recordedCount: recorded.length,
        passages: compPassages,
      };
    }).sort((a, b) => {
      if (b.recordedCount !== a.recordedCount) return b.recordedCount - a.recordedCount;
      return String(a.competitor.number).localeCompare(String(b.competitor.number), undefined, { numeric: true });
    });

    return ok({ eventId, stageId, checkpoints, results });
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const deletePassage = async (event) => {
  try {
    const competitorCode = getCompetitorCode(event);
    const { passageId } = event.pathParameters;

    const passageResult = await docClient.send(new GetCommand({ TableName: PASSAGES_TABLE, Key: { id: passageId } }));
    if (!passageResult.Item) return notFound('Průjezd nenalezen');
    const passage = passageResult.Item;

    const compResult = await docClient.send(new GetCommand({ TableName: COMPETITORS_TABLE, Key: { id: passage.competitorId } }));
    if (!compResult.Item) return notFound('Závodník nenalezen');

    const expectedCode = compResult.Item.stageCodes?.[passage.stageId];
    if (competitorCode && expectedCode && expectedCode !== competitorCode) return unauthorized('Neplatný kód závodníka');

    const cpResult = await docClient.send(new GetCommand({ TableName: CHECKPOINTS_TABLE, Key: { id: passage.checkpointId } }));
    if (cpResult.Item?.type === 'PK') return badRequest('Průjezdní kontrolu (PK) nelze smazat');

    // Zkontrolovat zamknutí — za tímto průjezdem nesmí být PK
    const allPassages = await docClient.send(new ScanCommand({
      TableName: PASSAGES_TABLE,
      FilterExpression: 'competitorId = :cid AND stageId = :sid AND #action = :rec',
      ExpressionAttributeNames: { '#action': 'action' },
      ExpressionAttributeValues: { ':cid': passage.competitorId, ':sid': passage.stageId, ':rec': 'recorded' },
    }));
    const sorted = (allPassages.Items || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const passageIndex = sorted.findIndex(p => p.id === passageId);

    for (let i = passageIndex + 1; i < sorted.length; i++) {
      const cp = await docClient.send(new GetCommand({ TableName: CHECKPOINTS_TABLE, Key: { id: sorted[i].checkpointId } }));
      if (cp.Item?.type === 'PK') return badRequest('SPK před zapsanou PK nelze smazat');
    }

    await docClient.send(new DeleteCommand({ TableName: PASSAGES_TABLE, Key: { id: passageId } }));
    return ok({ deleted: true });
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

module.exports = { recordPassage, listPassages, getResults, deletePassage };
