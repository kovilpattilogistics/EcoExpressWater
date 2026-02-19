import { Order } from '../types';

export const ADMIN_WHATSAPP_NUMBER = '919994604274';

export const formatOrderMessage = (order: Order, customerPhone?: string): string => {
    const itemsList = order.items.map(item =>
        `- ${item.productType}: ${item.quantity} ${item.productType.includes('Bottle') ? 'cases' : 'units'}`
    ).join('\n');

    return `*New Order Alert!* 🚀
Order #${order.id.slice(-6)}

👤 *Customer:* ${order.customerName}
📞 *Phone:* ${customerPhone || (order.customerId.startsWith('pub_') ? 'Guest' : 'Registered')}
📍 *Location:* ${order.deliveryLocation}

🛒 *Items:*
${itemsList}

💰 *Total Amount:* ₹${order.totalAmount}
📅 *Delivery:* ${order.deliveryDate} @ ${order.deliveryTime}
`.trim();
};

export const sendOrderToWhatsApp = (order: Order, customerPhone?: string) => {
    const message = formatOrderMessage(order, customerPhone);
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodedMessage}`;

    // Try to open in new tab
    window.open(url, '_blank');
};
