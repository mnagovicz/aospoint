const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { docClient, ok, created, badRequest, unauthorized, serverError, requireAdmin } = require('./utils');

const TABLE = process.env.COMPETITORS_TABLE;

const createCompetitor = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { id: eventId } = event.pathParameters;
    const body = JSON.parse(event.body || '{}');
    if (!body.driver) return badRequest('Jméno řidiče je povinné');
    if (!body.coDriver) return badRequest('Jméno spolujezdce je povinné');
    if (!body.number) return badRequest('Závodní číslo je povinné');

    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const item = {
      id: uuidv4(),
      eventId,
      driver: body.driver,
      coDriver: body.coDriver,
      name: `${body.driver} / ${body.coDriver}`,
      number: body.number,
      vehicle: body.vehicle || '',
      accessCode,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return created(item);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const listCompetitors = async (event) => {
  try {
    const { id: eventId } = event.pathParameters;
    const isAdmin = requireAdmin(event);

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'eventId-index',
      KeyConditionExpression: 'eventId = :eventId',
      ExpressionAttributeValues: { ':eventId': eventId },
    }));

    let items = result.Items || [];
    if (!isAdmin) {
      // Hide access codes from non-admins
      items = items.map(({ accessCode: _ac, ...rest }) => rest);
    }

    return ok(items.sort((a, b) => String(a.number).localeCompare(String(b.number))));
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

module.exports = { createCompetitor, listCompetitors };
