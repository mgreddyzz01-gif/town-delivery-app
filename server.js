const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// In-memory ledger storage
let orders = [];

// --- PAGES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// NEW: Serve Customer Portal Page
app.get('/order', (req, res) => {
    res.sendFile(path.join(__dirname, 'order.html'));
});

// --- API ENDPOINTS ---

// 1. New Customer Order Submission
app.post('/api/customer/order', (req, res) => {
    const { name, phone, items, address, paymentMethod } = req.body;

    const newOrder = {
        id: orders.length + 1,
        riderName: 'Unassigned',
        customerName: name || 'Guest',
        customerPhone: phone || '',
        items: items || '',
        address: address || '',
        paymentMethod: paymentMethod || 'COD',
        storeBill: 0,
        distanceKm: 0,
        deliveryFee: 0,
        totalCustomerPay: 0,
        fuelReimbursement: 0,
        riderNetPay: 0,
        operatorNetProfit: 0,
        settled: false,
        orderDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toLocaleTimeString()
    };

    orders.push(newOrder);
    res.json({ success: true, order: newOrder });
});

// 2. Rider Order Calculation Endpoint
app.post('/api/calculate-order', (req, res) => {
    const { storeBill, distanceKm, paymentMethod, riderName } = req.body;

    const bill = parseFloat(storeBill) || 0;
    const distance = parseFloat(distanceKm) || 0;

    // Delivery Fee Logic: ₹30 base (first 3km) + ₹10/km after
    let deliveryFee = 30;
    if (distance > 3) {
        deliveryFee += Math.ceil(distance - 3) * 10;
    }

    const totalCustomerPay = bill + deliveryFee;
    const fuelReimbursement = Math.round(distance * 3 * 10) / 10; // ₹3 per km
    const riderNetPay = 20; // Fixed payout per order
    const operatorNetProfit = deliveryFee - (fuelReimbursement + riderNetPay);

    const order = {
        id: orders.length + 1,
        riderName: riderName || 'Rider 1',
        paymentMethod: paymentMethod || 'COD',
        storeBill: bill,
        distanceKm: distance,
        deliveryFee: deliveryFee,
        totalCustomerPay: totalCustomerPay,
        fuelReimbursement: fuelReimbursement,
        riderNetPay: riderNetPay,
        operatorNetProfit: operatorNetProfit,
        settled: false,
        orderDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toLocaleTimeString()
    };

    orders.push(order);
    res.json({ success: true, order: order });
});

// 3. Admin Fetch Orders Endpoint
app.get('/api/admin/orders', (req, res) => {
    const { rider, date } = req.query;
    let filtered = [...orders];

    if (rider && rider !== 'ALL') {
        filtered = filtered.filter(o => o.riderName === rider);
    }

    if (date === 'TODAY') {
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(o => o.orderDate === today);
    }

    res.json(filtered);
});

// 4. Admin Mark Settled
app.post('/api/admin/settle', (req, res) => {
    orders.forEach(o => o.settled = true);
    res.json({ success: true });
});

// 5. Admin Clear Ledger
app.post('/api/admin/clear', (req, res) => {
    orders = [];
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});