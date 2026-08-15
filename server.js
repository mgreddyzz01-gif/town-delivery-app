const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

// In-memory orders array
let orders = [];
let nextOrderId = 101;

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/order', (req, res) => res.sendFile(path.join(__dirname, 'order.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// API: Customer submits order
app.post('/api/customer/order', (req, res) => {
    const newOrder = {
        id: nextOrderId++,
        name: req.body.name,
        phone: req.body.phone,
        items: req.body.items,
        address: req.body.address,
        paymentMethod: req.body.paymentMethod,
        status: 'Pending',
        rider: 'Unassigned'
    };
    orders.push(newOrder);
    res.json({ success: true, order: newOrder });
});

// API: Get all orders for Admin & Riders
app.get('/api/orders', (req, res) => {
    res.json(orders);
});

// API: Admin assigns rider
app.post('/api/orders/:id/assign', (req, res) => {
    const orderId = parseInt(req.params.id);
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.rider = req.body.rider;
        order.status = 'Assigned';
        return res.json({ success: true, order });
    }
    res.status(404).json({ success: false, message: 'Order not found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));