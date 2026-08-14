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

// CONSTANTS
const PETROL_PRICE = 113; // ₹113 / L
const MILEAGE = 40;       // 40 km / L
const FUEL_PER_KM = PETROL_PRICE / MILEAGE; // ~₹2.825/km

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
    const timestamp = new Date().toLocaleTimeString();

    const sql = `
        INSERT INTO orders (timestamp, riderName, paymentMethod, distanceKm, storeBill, deliveryFee, totalCustomerPay, fuelReimbursement, riderNetPay, operatorNetProfit, settled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const params = [
        timestamp,
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

// 2. Fetch Orders
app.get('/api/admin/orders', (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY id DESC`, [], (err, rows) => {
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