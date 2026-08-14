const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static HTML/JS files
app.use(express.static(__dirname));

// Connect / Create SQLite Database
const db = new sqlite3.Database(path.join(__dirname, 'orders.db'), (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Initialize Orders Table
db.run(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        orderDate TEXT,
        riderName TEXT,
        paymentMethod TEXT,
        distanceKm REAL,
        storeBill REAL,
        deliveryFee REAL,
        totalCustomerPay REAL,
        fuelReimbursement REAL,
        riderNetPay REAL,
        operatorNetProfit REAL,
        settled INTEGER DEFAULT 0
    )
`);

const PETROL_PRICE = 113; // ₹113 / L
const MILEAGE = 40;       // 40 km / L
const FUEL_PER_KM = PETROL_PRICE / MILEAGE;

// Serve Web Pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 1. Calculate & Save Order
app.post('/api/calculate-order', (req, res) => {
    const distanceKm = Number(req.body.distanceKm) || 0;
    const storeBill = Number(req.body.storeBill) || 0;
    const riderName = req.body.riderName || "Rider 1";
    const paymentMethod = req.body.paymentMethod || "COD";

    let deliveryFee = 55;
    if (distanceKm <= 2) {
        deliveryFee = 35;
    } else if (distanceKm <= 3) {
        deliveryFee = 45;
    } else {
        deliveryFee = 45 + (distanceKm - 3) * 18; 
    }

    const roundTripKm = distanceKm * 2;
    const fuelCost = roundTripKm * FUEL_PER_KM;
    const remainingMargin = Math.max(deliveryFee - fuelCost, 0); 
    
    const riderNetPay = remainingMargin * 0.65;
    const operatorNetProfit = remainingMargin * 0.35;
    const totalCustomerPay = storeBill + deliveryFee;
    
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    const orderDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

    const sql = `
        INSERT INTO orders (timestamp, orderDate, riderName, paymentMethod, distanceKm, storeBill, deliveryFee, totalCustomerPay, fuelReimbursement, riderNetPay, operatorNetProfit, settled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const params = [
        timestamp,
        orderDate,
        riderName,
        paymentMethod,
        distanceKm,
        storeBill,
        Math.round(deliveryFee),
        Math.round(totalCustomerPay),
        Number(fuelCost.toFixed(2)),
        Number(riderNetPay.toFixed(2)),
        Number(operatorNetProfit.toFixed(2))
    ];

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            order: {
                id: this.lastID,
                timestamp,
                orderDate,
                riderName,
                paymentMethod,
                distanceKm,
                storeBill,
                deliveryFee: Math.round(deliveryFee),
                totalCustomerPay: Math.round(totalCustomerPay),
                fuelReimbursement: Number(fuelCost.toFixed(2)),
                riderNetPay: Number(riderNetPay.toFixed(2)),
                operatorNetProfit: Number(operatorNetProfit.toFixed(2)),
                settled: 0
            }
        });
    });
});

// 2. Fetch Filtered Orders
app.get('/api/admin/orders', (req, res) => {
    const { rider, date } = req.query;
    let sql = `SELECT * FROM orders WHERE 1=1`;
    let params = [];

    if (rider && rider !== 'ALL') {
        sql += ` AND riderName = ?`;
        params.push(rider);
    }
    if (date && date !== 'ALL') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (date === 'TODAY') {
            sql += ` AND orderDate = ?`;
            params.push(todayStr);
        }
    }

    sql += ` ORDER BY id DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 3. Settle Balances
app.post('/api/admin/settle', (req, res) => {
    db.run(`UPDATE orders SET settled = 1 WHERE settled = 0`, [], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Settled all pending orders!" });
    });
});

// 4. Reset Data
app.post('/api/admin/clear', (req, res) => {
    db.run(`DELETE FROM orders`, [], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        db.run(`DELETE FROM sqlite_sequence WHERE name='orders'`, [], () => {});
        res.json({ message: "All orders cleared!" });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));