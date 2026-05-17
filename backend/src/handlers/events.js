const { PutCommand, GetCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { docClient, ok, created, badRequest, unauthorized, notFound, serverError, requireAdmin } = require('./utils');

const TABLE = process.env.EVENTS_TABLE;

const createEvent = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const body = JSON.parse(event.body || '{}');
    if (!body.name) return badRequest('Název eventu je povinný');

    const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez 0,O,I,1,L
    const accessCode = Array.from({ length: 6 }, () => SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]).join('');
    const item = {
      id: uuidv4(),
      name: body.name,
      date: body.date || new Date().toISOString().split('T')[0],
      status: 'draft', // draft | active | finished
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

const listEvents = async (event) => {
  try {
    // If accessCode query param provided, filter by it (competitor access)
    const accessCode = event.queryStringParameters?.accessCode;
    const result = await docClient.send(new ScanCommand({ TableName: TABLE }));
    let items = result.Items || [];

    if (accessCode) {
      items = items.filter(e => e.accessCode === accessCode.toUpperCase());
      // Don't expose accessCode to competitors
      items = items.map(({ accessCode: _ac, ...rest }) => rest);
    } else if (!requireAdmin(event)) {
      // Public listing without admin key - hide sensitive data
      items = items.map(({ accessCode: _ac, ...rest }) => rest);
    }

    return ok(items);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const getEvent = async (event) => {
  try {
    const { id } = event.pathParameters;
    const result = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id } }));
    if (!result.Item) return notFound('Event nenalezen');

    const item = result.Item;
    if (!requireAdmin(event)) {
      const { accessCode: _ac, ...rest } = item;
      return ok(rest);
    }
    return ok(item);
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

const deleteEvent = async (event) => {
  try {
    if (!requireAdmin(event)) return unauthorized();
    const { id } = event.pathParameters;

    const existing = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id } }));
    if (!existing.Item) return notFound('Soutěž nenalezena');

    // Smazat soutěž
    await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
    return ok({ deleted: true });
  } catch (err) {
    console.error(err);
    return serverError(err.message);
  }
};

module.exports = { createEvent, listEvents, getEvent, deleteEvent };
