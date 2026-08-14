const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static HTML/JS files from the root directory
app.use(express.static(__dirname));

// In-memory orders array
let orders = [];
let nextOrderId = 1;

// CONSTANTS
const PETROL_PRICE = 113; // ₹113 / L
const MILEAGE = 40;       // 40 km / L
const FUEL_PER_KM = PETROL_PRICE / MILEAGE; // ~₹2.825/km

// Serve Web Pages directly
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

    const newOrder = {
        id: nextOrderId++,
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
    };

    orders.push(newOrder);
    res.json({ order: newOrder });
});

// 2. Fetch Orders
app.get('/api/admin/orders', (req, res) => {
    res.json([...orders].reverse());
});

// 3. Settle Balances
app.post('/api/admin/settle', (req, res) => {
    orders.forEach(o => o.settled = 1);
    res.json({ message: "Settled all pending orders!" });
});

// 4. Reset Data
app.post('/api/admin/clear', (req, res) => {
    orders = [];
    nextOrderId = 1;
    res.json({ message: "All orders cleared!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));