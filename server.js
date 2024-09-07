const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mysql = require('mysql2');
const moment = require('moment');

// Create a MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: 'password', 
    database: 'chat_app'
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

// WebSocket connection
wss.on('connection', (ws) => {
    console.log('New client connected');

    // Send previous chat messages to the newly connected client
    db.query('SELECT * FROM messages ORDER BY timestamp ASC', (err, results) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return;
        }
        results.forEach((row) => {
            ws.send(JSON.stringify({
                username: row.username,
                message: row.message,
                timestamp: row.timestamp
            }));
        });
    });

    ws.on('message', (message) => {
        const messageData = JSON.parse(message);
        const { username, message: text, timestamp } = messageData;

        // Convert timestamp to MySQL DATETIME format
        const formattedTimestamp = moment(timestamp).format('YYYY-MM-DD HH:mm:ss');

        // Insert message into the database
        db.query('INSERT INTO messages (username, message, timestamp) VALUES (?, ?, ?)',
            [username, text, formattedTimestamp],
            (err) => {
                if (err) {
                    console.error('Error inserting message:', err);
                    return;
                }

                // Broadcast message to all clients
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(messageData));
                    }
                });
            });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start server
server.listen(3002, () => {
    console.log('Server is running on http://localhost:3002');
});
