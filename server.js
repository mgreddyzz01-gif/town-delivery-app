const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, 'orders.json');

// Helper to read orders
function getOrders() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

// Helper to save orders
function saveOrders(orders) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

const PETROL_PRICE = 113; // ₹113 / L
const MILEAGE = 40;       // 40 km / L
const FUEL_PER_KM = PETROL_PRICE / MILEAGE;

// Web Routes
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
    const orderDate = now.toISOString().split('T')[0];

    const orders = getOrders();
    const newOrder = {
        id: orders.length + 1,
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
    };

    orders.push(newOrder);
    saveOrders(orders);

    res.json({ order: newOrder });
});

// 2. Fetch Filtered Orders
app.get('/api/admin/orders', (req, res) => {
    const { rider, date } = req.query;
    let orders = getOrders();

    if (rider && rider !== 'ALL') {
        orders = orders.filter(o => o.riderName === rider);
    }
    if (date && date !== 'ALL') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (date === 'TODAY') {
            orders = orders.filter(o => o.orderDate === todayStr);
        }
    }

    res.json(orders.reverse());
});

// 3. Settle Balances
app.post('/api/admin/settle', (req, res) => {
    let orders = getOrders();
    orders = orders.map(o => ({ ...o, settled: 1 }));
    saveOrders(orders);
    res.json({ message: "Settled all pending orders!" });
});

// 4. Reset Data
app.post('/api/admin/clear', (req, res) => {
    saveOrders([]);
    res.json({ message: "All orders cleared!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));