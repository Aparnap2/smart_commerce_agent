import { z } from 'zod';
import { tool } from 'ai';
import { Client } from 'pg';
import { env } from '../env.js';

// Security: Validate email ownership (in production, this would verify via token/session)
function validateEmailAccess(requestedEmail, userEmail) {
  if (!userEmail) {
    throw new Error('🔒 **Authentication Required**: Please provide your email address to access your data.');
  }

  if (requestedEmail && requestedEmail !== userEmail) {
    throw new Error('🚫 **Access Denied**: You can only access data associated with your own email address.');
  }

  return true;
}

export async function queryDatabase(query, params) {
  const pgClient = new Client({
    connectionString: env.DATABASE_URL,
  });

  try {
    await pgClient.connect();
    const { rows } = await pgClient.query(query, params);
    return rows;
  } catch (error) {
    console.error('[ERROR] Database query error:', error.message);
    throw new Error(`🔧 **Database Error**: Unable to execute query. ${error.message}`);
  } finally {
    try {
      await pgClient.end();
    } catch (err) {
      console.error('[ERROR] Error closing database connection:', err.message);
    }
  }
}

async function checkTableExists(tableName) {
  try {
    // Check if table exists - PostgreSQL information_schema stores table names as they were created
    const result = await queryDatabase(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_name = $1 AND table_schema = 'public'
       )`,
      [tableName]  // Keep the capitalized table name as it was created
    );
    return result[0].exists;
  } catch (error) {
    console.error('[ERROR] Failed to check table existence:', error.message);
    throw new Error(`🔧 **Database Schema Error**: Unable to verify table "${tableName}" exists. ${error.message}`);
  }
}

const databaseQueryTool = tool({
  description: '🔒 **SECURE DATABASE ACCESS** - Query your personal data from the production database (customers, products, orders, support tickets). **AUTHENTICATION REQUIRED**: You MUST provide your email address to access any data. This tool enforces strict data privacy - you can only access data associated with your own email address. **NO FALLBACK DATA** - Only real database connections are supported.',
  parameters: z.object({
    type: z.enum(['customer', 'product', 'order', 'ticket']).describe('Type of query: "customer", "product", "order", or "ticket"'),
    userEmail: z.string().describe('🔒 **REQUIRED**: Your email address for authentication and data access control. You can only access data associated with this email.'),
    identifiers: z
      .array(
        z.object({
          productId: z.string().optional().describe('Product ID to filter by (products are public data)'),
          orderId: z.string().optional().describe('Order ID to filter by (must belong to your email)'),
          ticketId: z.string().optional().describe('Ticket ID to filter by (must belong to your email)'),
          email: z.string().optional().describe('Customer email to filter by (must match your userEmail for security)'),
        })
      )
      .min(1)
      .describe('At least one identifier is required'),
  }),
  execute: async ({ type, userEmail, identifiers }) => {


    try {
      // Security: Validate user email is provided
      if (!userEmail) {
        return {
          error: true,
          message: '🔒 **Authentication Required**: Please provide your email address to access your data.',
          suggestion: 'Include your email in the userEmail parameter to access your personal information.',
          llm_formatted_data: '⚠️ **Access Denied**: Email authentication is required for data access.'
        };
      }

      // Security: Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEmail)) {
        return {
          error: true,
          message: '❌ **Invalid Email Format**: Please provide a valid email address.',
          suggestion: 'Ensure your email follows the format: user@domain.com',
          llm_formatted_data: '⚠️ **Error**: Invalid email format provided.'
        };
      }

      // Security: Validate all identifier emails match user email (except for products)
      identifiers.forEach((id) => {
        if (id.email) {
          if (!emailRegex.test(id.email)) {
            throw new Error(`❌ Invalid email format: ${id.email}`);
          }
          if (type !== 'product') {
            validateEmailAccess(id.email, userEmail);
          }
        }
      });

      // Test database connection
      await queryDatabase('SELECT 1', []);
      
      // Enhanced validation with security checks
      if (type === 'product' && !identifiers.some((id) => id.productId)) {
        throw new Error('🛍️ **Product Query Error**: productId is required for product queries');
      }
      if (type === 'order' && !identifiers.some((id) => id.orderId || id.email)) {
        throw new Error('📦 **Order Query Error**: Either orderId or email is required for order queries');
      }
      if (type === 'ticket' && !identifiers.some((id) => id.ticketId || id.email)) {
        throw new Error('🎫 **Ticket Query Error**: Either ticketId or email is required for ticket queries');
      }
      if (type === 'customer' && !identifiers.some((id) => id.email)) {
        throw new Error('👤 **Customer Query Error**: email is required for customer queries');
      }

      const tableMap = {
        customer: 'Customer',
        product: 'Product',
        order: 'Order',
        ticket: 'SupportTicket',
      };
      const tableName = tableMap[type];
      const tableExists = await checkTableExists(tableName);
      
      if (!tableExists) {
        throw new Error(`🗄️ **Database Schema Error**: Table "${tableName}" does not exist. Please contact support to set up the database schema.`);
      }

      let result;
      switch (type) {
        case 'customer': {
          // Security: Only allow access to user's own customer data
          const customerEmails = identifiers.map((id) => id.email).filter(Boolean);
          
          // If no specific email provided, use the authenticated user's email
          const emailsToQuery = customerEmails.length > 0 ? customerEmails : [userEmail];
          
          // Security: Validate all requested emails match the authenticated user
          emailsToQuery.forEach(email => validateEmailAccess(email, userEmail));
          
          const customerQuery = `SELECT id, name, email, phone, address, "paymentMethod", "billingAddress" FROM "Customer" WHERE email = ANY($1)`;

          result = await queryDatabase(customerQuery, [emailsToQuery]);
          const customerData = {
            type: 'customer',
            data: result.map((customer) => ({
              id: customer.id,
              name: customer.name || 'Unknown',
              email: customer.email,
              phone: customer.phone || 'Not provided',
              address: customer.address || 'Not provided',
              paymentMethod: customer.paymentMethod || 'Not set',
              billingAddress: customer.billingAddress || customer.address || 'Not provided',
            })),
            summary: result.length > 0
              ? `👤 Found ${result.length} customer profile(s)`
              : '❌ No customer profile found',
            llm_formatted_data: result.length > 0
              ? `## 👤 **Your Customer Profile**\n\n` + result.map((customer) => 
                  `### Customer #${customer.id}: ${customer.name || 'Unknown'}\n- 📧 **Email**: ${customer.email}\n- 📞 **Phone**: ${customer.phone || 'Not provided'}\n- 🏠 **Address**: ${customer.address || 'Not provided'}\n- 💳 **Payment**: ${customer.paymentMethod || 'Not set'}\n- 📄 **Billing**: ${customer.billingAddress || customer.address || 'Not provided'}`
                ).join('\n\n')
              : '❌ **No customer profile found** with that email address.'
          };
          

          return customerData;
        }

        case 'product': {
          // Products are public data - no email restriction needed
          const productIds = identifiers.map((id) => parseInt(id.productId)).filter(Boolean);
          const productQuery = `SELECT id, name, description, price, stock, category, sku, rating FROM "Product" WHERE id = ANY($1)`;

          result = await queryDatabase(productQuery, [productIds]);
          const productData = {
            type: 'product',
            data: result.map((product) => ({
              id: product.id,
              name: product.name,
              price: `$${parseFloat(product.price).toFixed(2)}`,
              description: product.description || 'No description',
              stock: product.stock,
              available: product.stock > 0 ? 'In stock' : 'Out of stock',
              category: product.category || 'General',
              sku: product.sku || 'N/A',
              rating: product.rating ? `${product.rating}/5.0` : 'Not rated',
            })),
            summary: result.length > 0
              ? `🛍️ Found ${result.length} product(s)`
              : '❌ No products found',
            llm_formatted_data: result.length > 0
              ? `## 🛍️ **Product Catalog**\n\n| **ID** | **Name** | **Price** | **Stock** | **Description** |\n|--------|----------|-----------|-----------|-----------------|\n` +
                result.map((product) => 
                  `| ${product.id} | ${product.name} | $${parseFloat(product.price).toFixed(2)} | ${product.stock > 0 ? `✅ ${product.stock}` : '❌ Out'} | ${product.category} | ${product.rating} | ${product.description || 'No description'} |`
                ).join('\n')
              : '❌ **No products found** matching your criteria.'
          };
          

          return productData;
        }

        case 'order': {
          // Security: Build secure query that only returns user's orders
          let orderQuery = `SELECT o.id, o."orderDate" as order_date, o.total, o.status, o.quantity,
                                  o."paymentStatus", o."shippingAddress", o."trackingNumber",
                                  c.name AS customer_name, c.email AS customer_email,
                                  p.name AS product_name, p.price AS product_price
                           FROM "Order" o
                           JOIN "Customer" c ON o."customerId" = c.id
                           JOIN "Product" p ON o."productId" = p.id
                           WHERE c.email = $1`;
          
          let orderParams = [userEmail];
          let paramIndex = 2;
          
          // Add additional filters if provided
          const orderConditions = [];
          identifiers.forEach((id) => {
            if (id.orderId) {
              orderConditions.push(`o.id = $${paramIndex}`);
              orderParams.push(parseInt(id.orderId));
              paramIndex++;
            }
            if (id.email) {
              // Security: Validate email access
              validateEmailAccess(id.email, userEmail);
              // Email condition already covered by base query
            }
          });
          
          if (orderConditions.length > 0) {
            orderQuery += ` AND (${orderConditions.join(' OR ')})`;
          }

          result = await queryDatabase(orderQuery, orderParams);
          
          const formattedData = {
            type: 'order',
            data: result.map((order) => ({
              id: order.id,
              customer: {
                name: order.customer_name || 'Unknown',
                email: order.customer_email,
              },
              product: {
                name: order.product_name,
                price: `$${parseFloat(order.product_price).toFixed(2)}`,
              },
              status: order.status,
              orderDate: new Date(order.order_date).toISOString(),
              quantity: order.quantity || 1,
              paymentStatus: order.paymentStatus || 'Pending',
              shippingAddress: order.shippingAddress || 'Not specified',
              trackingNumber: order.trackingNumber || 'Not available',
            })),
            summary: result.length > 0
              ? `📦 Found ${result.length} order(s)`
              : '❌ No orders found',
            llm_formatted_data: result.length > 0
              ? `## 📦 **Your Orders**\n\n` + result.map((order) => 
                  `### Order #${order.id}: ${order.product_name}\n- 💰 **Price**: $${parseFloat(order.product_price).toFixed(2)}\n- 📦 **Qty**: ${order.quantity}\n- 📊 **Status**: ${order.status === 'Delivered' ? '✅' : order.status === 'Shipped' ? '🚚' : '⏳'} ${order.status}\n- 💳 **Payment**: ${order.paymentStatus}\n- 📦 **Tracking**: ${order.trackingNumber || 'N/A'}\n- 📅 **Ordered on**: ${new Date(order.order_date).toLocaleDateString()}`
                ).join('\n\n')
              : '❌ **No orders found** for your account.'
          };
          

          return formattedData;
        }

        case 'ticket': {
          // Security: Build secure query that only returns user's tickets
          let ticketQuery = `SELECT st.id, st.issue, st.status, st."createdAt" as created_at,
                                   st.priority, st."relatedOrderId", st.resolution,
                                   c.name AS customer_name, c.email AS customer_email
                            FROM "SupportTicket" st
                            JOIN "Customer" c ON st."customerId" = c.id
                            WHERE c.email = $1`;
          
          let ticketParams = [userEmail];
          let paramIndex = 2;
          
          // Add additional filters if provided
          const ticketConditions = [];
          identifiers.forEach((id) => {
            if (id.ticketId) {
              ticketConditions.push(`st.id = $${paramIndex}`);
              ticketParams.push(parseInt(id.ticketId));
              paramIndex++;
            }
            if (id.email) {
              // Security: Validate email access
              validateEmailAccess(id.email, userEmail);
              // Email condition already covered by base query
            }
          });
          
          if (ticketConditions.length > 0) {
            ticketQuery += ` AND (${ticketConditions.join(' OR ')})`;
          }

          result = await queryDatabase(ticketQuery, ticketParams);

          const ticketData = {
            type: 'ticket',
            data: result.map((ticket) => ({
              id: ticket.id,
              customer: {
                name: ticket.customer_name || 'Unknown',
                email: ticket.customer_email,
              },
              issue: ticket.issue,
              status: ticket.status,
              createdAt: new Date(ticket.created_at).toISOString(),
              priority: ticket.priority || 'Medium',
              relatedOrderId: ticket.relatedOrderId || null,
              resolution: ticket.resolution || 'Pending',
            })),
            summary: result.length > 0
              ? `🎫 Found ${result.length} support ticket(s)`
              : '❌ No support tickets found',
            llm_formatted_data: result.length > 0
              ? `## 🎫 **Your Support Tickets**\n\n` + result.map((ticket) =>
                  `### Ticket #${ticket.id}: ${ticket.issue}\n- 🔴 **Priority**: ${ticket.priority}\n- 📊 **Status**: ${ticket.status === 'Resolved' ? '✅' : '🔄'} ${ticket.status}\n- 📅 **Created**: ${new Date(ticket.created_at).toLocaleDateString()}\n- 👤 **Customer**: ${ticket.customer_name || 'Unknown'} (${ticket.customer_email})\n- 🔗 **Order**: ${ticket.relatedOrderId || 'N/A'}\n- ✅ **Resolution**: ${ticket.resolution || 'Pending'}`
                ).join('\n\n')
              : '❌ **No support tickets found** for your account.'
          };


          return ticketData;
        }

        default:
          throw new Error(`Invalid query type: ${type}`);
      }
    } catch (error) {
      console.error('[ERROR] Secure database query error:', error.message);
      
      // Security: Don't expose internal error details
      if (error.message.includes('Access Denied') || error.message.includes('Authentication Required')) {
        return {
          error: true,
          message: error.message,
          suggestion: 'Please provide your email address to access your personal data.',
          llm_formatted_data: '🔒 **Authentication Required**: Please provide your email to continue.'
        };
      }
      
      return {
        error: true,
        message: `❌ **Query Failed**: ${error.message}`,
        suggestion: 'Please check your parameters and ensure you have access to the requested data.',
        llm_formatted_data: '⚠️ **Error**: Unable to process your request. Please verify your information and try again.'
      };
    }
  },
});

// Export secure databaseQueryTool (NO FALLBACK)

export { databaseQueryTool };