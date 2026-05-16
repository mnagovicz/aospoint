const { PutCommand, QueryCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
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
    if (!body.action || !['recorded', 'ignored'].includes(body.action)) {
      return badRequest('action musí být "recorded" nebo "ignored"');
    }

    // Verify competitor exists and code matches (if provided)
    const compResult = await docClient.send(new GetCommand({
      TableName: COMPETITORS_TABLE,
      Key: { id: body.competitorId },
    }));
    if (!compResult.Item) return notFound('Závodník nenalezen');
    if (competitorCode && compResult.Item.accessCode !== competitorCode) {
      return unauthorized('Neplatný kód závodníka');
    }

    // Count existing passages for this competitor+checkpoint to determine passageNumber
    const existingResult = await docClient.send(new ScanCommand({
      TableName: PASSAGES_TABLE,
      FilterExpression: 'competitorId = :cid AND checkpointId = :cpid',
      ExpressionAttributeValues: {
        ':cid': body.competitorId,
        ':cpid': body.checkpointId,
      },
      Select: 'COUNT',
    }));
    const passageNumber = (existingResult.Count || 0) + 1;

    const item = {
      id: uuidv4(),
      competitorId: body.competitorId,
      checkpointId: body.checkpointId,
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
    const { id: eventId } = event.pathParameters;

    const [cpResult, compResult, passResult] = await Promise.all([
      docClient.send(new QueryCommand({
        TableName: CHECKPOINTS_TABLE,
        IndexName: 'eventId-index',
        KeyConditionExpression: 'eventId = :eid',
        ExpressionAttributeValues: { ':eid': eventId },
      })),
      docClient.send(new QueryCommand({
        TableName: COMPETITORS_TABLE,
        IndexName: 'eventId-index',
        KeyConditionExpression: 'eventId = :eid',
        ExpressionAttributeValues: { ':eid': eventId },
      })),
      docClient.send(new ScanCommand({
        TableName: PASSAGES_TABLE,
        FilterExpression: 'eventId = :eid',
        ExpressionAttributeValues: { ':eid': eventId },
      })),
    ]);

    const checkpoints = (cpResult.Items || []).sort((a, b) => a.order - b.order);
    const competitors = compResult.Items || [];
    const passages = passResult.Items || [];

    // Build results per competitor
    const results = competitors.map(comp => {
      const compPassages = passages
        .filter(p => p.competitorId === comp.id)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const recorded = compPassages.filter(p => p.action === 'recorded');

      // Group all passages by checkpointId
      const checkpointPassagesMap = {};
      compPassages.forEach(p => {
        if (!checkpointPassagesMap[p.checkpointId]) {
          checkpointPassagesMap[p.checkpointId] = [];
        }
        checkpointPassagesMap[p.checkpointId].push({
          passageNumber: p.passageNumber || 1,
          timestamp: p.timestamp,
          action: p.action,
        });
      });
      // Sort each checkpoint's passages by timestamp
      Object.values(checkpointPassagesMap).forEach(arr =>
        arr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      );

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
        recordedCount: recorded.length, // total recorded passages, can exceed CP count
        passages: compPassages,
        checkpointDetails: checkpoints.map(cp => ({
          checkpoint: cp,
          passages: checkpointPassagesMap[cp.id] || [],
        })),
      };
    }).sort((a, b) => {
      // Sort by recorded count desc, then by competitor number
      if (b.recordedCount !== a.recordedCount) return b.recordedCount - a.recordedCount;
      return String(a.competitor.number).localeCompare(String(b.competitor.number));
    });

    return ok({ eventId, checkpoints, results });
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

module.exports = { recordPassage, listPassages, getResults };
