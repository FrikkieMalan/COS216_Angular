#!/usr/bin/env node
require('dotenv').config({ path: './Wheatley.env' });

const WebSocket = require('ws');
const axios     = require('axios');
const readline  = require('readline');
const {
  WHEATLEY_USER,
  WHEATLEY_PASS,
  WHEATLEY_BASE_URL
} = process.env;

const HQ = { lat: 25.7472, lng: 28.2511 };
function distanceKm(a, b) {
  const toRad = x => x * Math.PI/180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const R = 6371;
  const h = Math.sin(dLat/2)**2
              + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))
                * Math.sin(dLng/2)**2;
  return 2*R * Math.asin(Math.sqrt(h));
}

function broadcastToAll(msgObj, clients) {
  for (let [s] of clients) {
    s.send(JSON.stringify(msgObj));
  }
}

const apiClient = axios.create({
  baseURL: WHEATLEY_BASE_URL,
  auth:    { username: WHEATLEY_USER, password: WHEATLEY_PASS }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function askPort() {
  return new Promise(resolve => {
    rl.question('Enter port (1024–49151): ', answer => {
      const port = parseInt(answer, 10);
      if (port >= 1024 && port <= 49151) resolve(port);
      else {
        console.log('Invalid port. Try again.');
        resolve(askPort());
      }
    });
  });
}

(async () => {
  const port = await askPort();
  rl.close();
  const clients = new Map(); 
  const wss     = new WebSocket.Server({ port }, () =>
    console.log(`WebSocket server listening on ws://localhost:${port}`)
  );
  wss.on('connection', ws => {
    console.log('Client connected');
    ws.on('message', async raw => {
      try {
        const msgJsonParsed = JSON.parse(raw);
        switch (msgJsonParsed.cmd) {
          case 'LOGIN': {
            const { username, password, studentnum } = msgJsonParsed.payload;
            const uRes = await apiClient.post('', {
              type: 'Login',
              email: username, password, studentnum
            });
            const apikey = uRes?.data.data[0].apikey;
            const id = uRes?.data.data[0].id;
            const type = uRes?.data.data[0].type;
            if (!apikey) {
                ws.send(JSON.stringify({
                  status:  'ERROR',
                  message: 'Login failed: no user found'
                }));
                break;
            }
            clients.set(ws, { username, apikey, role:type, studentnum });
            ws.send(JSON.stringify({
              status:'OK', cmd:'LOGGED IN ' + username + ' AS ' + type
            }));
            break;
          }
          case 'KILL': {
            for (let [s, info] of clients) {
              if (info.username === msgJsonParsed.payload.targetUsername) {
                s.send(JSON.stringify({ status:'INFO', cmd:'KILLED' }));
                s.close();
                clients.delete(s);
                ws.send(`User ${info.username} disconnected.\n`);
                break;
              }
            }
            break;
          }
          case 'CREATE_ORDER': {
            const { apikey, studentnum, customer_id } = msgJsonParsed.payload;
            try {
            const res = await apiClient.post('', {
              type:       'CreateOrder',
              apikey, studentnum, customer_id
            });
            ws.send(JSON.stringify({
              status:'OK',
              cmd:'CREATE_ORDER_RESULT',
              data:res.data
            }));
          } catch {
            console.error('CREATE_ORDER failed:', err.response?.data || err.message);
            ws.send(JSON.stringify({
              status: 'ERROR',
              cmd:    'CREATE_ORDER_RESULT',
              data:   err.response?.data || { message: err.message }
            }));
          }
            break;
          }
          case 'CREATE_DRONE': {
            const { apikey, studentnum } = msgJsonParsed.payload;
            const res = await apiClient.post('', {
              type:       'CreateDrone',
              apikey, studentnum
            });
            ws.send(JSON.stringify({
              status:'OK',
              cmd:'CREATE_DRONE_RESULT',
              data:res.data
            }));
            break;
          }
          case 'UPDATE_ORDER': {
            const p   = msgJsonParsed.payload;
            if (p.state === 'Out for delivery') {
              const dist = distanceKm(HQ, { lat: p.dest_lat, lng: p.dest_lng });
              if (dist > 5) {
                return ws.send(JSON.stringify({
                  status:  'ERROR',
                  cmd:     'UPDATE_ORDER_RESULT',
                  message: `Cannot deliver ${dist.toFixed(2)} km away, max is 5 km.`
                }));
              }
            }
            const res = await apiClient.post('', {
              type:       'UpdateOrder',
              apikey:     p.apikey,
              studentnum: p.studentnum,
              order_id:   p.order_id,
              dest_lat:   p.dest_lat,
              dest_lng:   p.dest_lng,
              state:      p.state
            });
            ws.send(JSON.stringify({
              status:'OK',
              cmd:'UPDATE_ORDER_RESULT',
              data:res.data
            }));
            const info = clients.get(ws) || {};
            if (info.role === 'Courier') {
              info.lastLat     = p.dest_lat;
              info.lastLng     = p.dest_lng;
              if (p.state === 'Out for delivery') {
                info.onDelivery      = true;
                info.currentOrderId  = p.order_id;
                info.currentDroneId  = p.drone_id   || info.currentDroneId;
                info.lastBattery     = p.battery    || info.lastBattery;
                info.lastAltitude    = p.altitude   || info.lastAltitude;
              }
              if (['Delivered','Storage'].includes(p.state)) {
                info.onDelivery = false;
              }
              clients.set(ws, info);
            }
            break;
          }
          case 'GET_ALL_ORDERS': {
            const { apikey, studentnum } = msgJsonParsed.payload;
            const res = await apiClient.post('', {
              type:       'GetAllOrders',
              apikey, studentnum
            });
            ws.send(JSON.stringify({
              status: 'OK',
              cmd:    'GET_ALL_ORDERS_RESULT',
              data:   res.data.data 
            }));
            break;
          }
          case 'CURRENTLY DELIVERING': {
            const { apikey, studentnum } = msgJsonParsed.payload;
            const res = await apiClient.post('', {
              type:       'GetOutForDelivery',
              apikey, studentnum
            });
            ws.send(JSON.stringify({
              status:'OK',
              cmd:   'CURRENTLY_DELIVERING_RESULT',
              data:  res.data.data   
            }));
            break;
          }
          case 'QUIT': {
            broadcastToAll({ status:'INFO', cmd:'SERVER_SHUTDOWN' }, clients);
            clients.forEach((_, s) => s.close());
            wss.close();
            console.log('Server shutting down.');
            break;
          }
          case 'DRONE STATUS': {
            const { apikey, studentnum } = msgJsonParsed.payload;
            const res = await apiClient.post('', {
              type:       'GetAllDrones',
              apikey, studentnum
            });
            ws.send(JSON.stringify({
              status:'OK',
              cmd:'DRONE_STATUS_RESULT',
              data:res.data
            }));
            break;
          }
          case 'UPDATE_DRONE': {
            const { apikey, studentnum, id, current_operator_id,
              is_available, latest_lat, latest_lng, altitude,
              battery_level } = msgJsonParsed.payload;
            const res = await apiClient.post('', {
              type: 'UpdateDrone',
              apikey, studentnum, id,
              current_operator_id, is_available,
              latest_lat, latest_lng,
              altitude, battery_level
            });
            ws.send(JSON.stringify({
              status: 'OK',
              cmd:    'UPDATE_DRONE_RESULT',
              data:   res.data
            }));
            break;
          }
          case 'GET_ALL_DRONES': {
            const { apikey, studentnum } = msgJsonParsed.payload;
            const res = await apiClient.post('', {
              type:       'GetAllDrones',
              apikey, studentnum
            });
            ws.send(JSON.stringify({
              status: 'OK',
              cmd:    'GET_ALL_DRONES_RESULT',
              data:   res.data.data   
            }));
            break;
          }
          default:
            ws.send(JSON.stringify({
              status:'ERROR',
              message:'Unknown command'
            }));
        }
      } catch (err) {
        console.error('Error processing message:', err);
        ws.send(JSON.stringify({
          status:  'ERROR',
          message: `Bad message format: ${err.message}`
        }));
      }
    });

    ws.on('close', async () => {
      const info = clients.get(ws);
      clients.delete(ws);
      if (info?.role === 'Courier' && info.onDelivery) {
        broadcastToAll({
          cmd:'DELIVERY_POSTPONED',
          message:`Courier ${info.username} disconnected—delivery postponed.`
        }, clients);
        await apiClient.post('', {
          type:'UpdateOrder', apikey:info.apikey,
          studentnum:info.studentnum,
          order_id:info.currentOrderId,
          dest_lat:info.lastLat, dest_lng:info.lastLng,
          state:'Storage'
        });
        await apiClient.post('', {
          type:'UpdateDrone',
          apikey:info.apikey,
          studentnum:info.studentnum,
          id:info.currentDroneId,
          current_operator_id:null,
          is_available:0,
          latest_lat:info.lastLat,
          latest_lng:info.lastLng,
          altitude:info.lastAltitude+5,
          battery_level:info.lastBattery
        });
      }
    });
    ws.on('error', err => {
      console.error('WebSocket error:', err.message);
    });
  });
})();

async function fetchCustomer(id, apikey, studentnum) {
  const res = await apiClient.post('', {
    type:'GetUser', apikey, studentnum, user_id:id
  });
  return res.data.data;
}