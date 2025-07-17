// 🆓 LIQUIDVIBES FULFILLMENT SERVER - WITH CUSTOM BUNDLE SELECTION
// Save this as: server.js (replace your entire server.js with this)

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for testing
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'stripe-signature']
}));
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Keep server awake
setInterval(() => {
  console.log('🔄 Keeping server active...');
}, 14 * 60 * 1000);

// Email transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Store for custom bundle selections (in production, use a database)
const bundleSelections = new Map();

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'LiquidVibes FREE Fulfillment Server Running! 🆓',
    timestamp: new Date().toISOString(),
    tier: 'Free - Render.com',
    selections: bundleSelections.size
  });
});

// NEW: Endpoint to save bundle selections
app.post('/save-selection', (req, res) => {
  try {
    const { sessionId, selections, type } = req.body;
    
    if (!sessionId || !selections || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Store the selection with a temporary key
    const selectionKey = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    bundleSelections.set(selectionKey, {
      selections,
      type,
      timestamp: new Date(),
      sessionId
    });
    
    console.log(`💾 Saved ${type} selection:`, selections);
    
    res.json({ 
      success: true, 
      selectionKey,
      message: 'Selection saved successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error saving selection:', error);
    res.status(500).json({ error: 'Failed to save selection' });
  }
});

// NEW: Endpoint to get available files
app.get('/files/:type', (req, res) => {
  const type = req.params.type;
  
  const fileMap = {
    images: {
      '1.png': '1NP2kWc03vozTlxWneaInrGIZo9XmEMUn',
      '2.png': '15QZUobKAfaOtRgIU7nTH-aYQIE19Qw9q',
      '3.png': '1wCuBXHbBgwzMBIliyPeOYtj18nl1ZTsL',
      '4.png': '1pFANqrEiLmMULrcqSKZidku-BaDliOTl',
      '5.png': '1QVfp-ENDpgfBy9dTx8tLRDIaa5FIjym_',
      '6.png': '1kJZ_NxFDvtpP8MLaEsc2jeLrJMcoUWXm',
      '7.png': '18fvjsf_VeVMjWzGcMj1XwGoXQWW_m4_l',
      '8.png': '12mWxSHu8t7l3Is1z1G_0-D1VzYdQaKnk',
      '9.png': '17yAz-W0o3vWWIB-a72pyIYAaduZSlxoo',
      '10.png': '1z-WGL792vfo_jiNzjdktvM9sJtrJrSic'
    },
    videos: {
      '1.mp4': '1MqwU9kcoGJgCNw7Xaqr-RDwKZgz56mYy',
      '2.mp4': '1o2L5MSK53adayK4v_86Vv-DjaVCm-Wll',
      '3.mp4': '1c9juFIsWrlUSCEMPzlqb306Jsi2P_I9E',
      '4.mp4': '1OSUMX0XL-BgttCtEZVlGo7YM7zOW94Hp'
    }
  };
  
  res.json(fileMap[type] || {});
});

// Webhook endpoint
app.post('/webhook', async (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      request.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`⚠️ Webhook signature verification failed.`, err.message);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('💰 Payment successful:', session.id);
    await fulfillOrder(session);
  }

  response.status(200).send('Received');
});

// Order fulfillment logic
async function fulfillOrder(session) {
  try {
    const customerEmail = session.customer_details.email;
    const customerName = session.customer_details.name || 'Valued Customer';
    const amount = session.amount_total;
    const sessionId = session.id;

    console.log(`🎨 Processing order for: ${customerEmail}, Amount: $${amount/100}`);

    // Check if this is a custom bundle by looking for stored selections
    const customSelection = findCustomSelection(sessionId, amount);
    
    let productInfo;
    
    if (customSelection) {
      productInfo = createCustomProductInfo(customSelection, amount);
      // Clean up the stored selection
      bundleSelections.delete(customSelection.key);
    } else {
      productInfo = getProductInfo(amount);
    }
    
    if (!productInfo) {
      console.error('❌ Unknown product amount:', amount);
      return;
    }

    await sendFulfillmentEmail(customerEmail, customerName, productInfo, sessionId);
    console.log('✅ Fulfillment email sent successfully');

  } catch (error) {
    console.error('❌ Fulfillment failed:', error);
  }
}

// NEW: Find custom selection for this payment
function findCustomSelection(sessionId, amount) {
  const now = new Date();
  const oneHourAgo = new Date(now - 60 * 60 * 1000); // 1 hour timeout
  
  for (const [key, selection] of bundleSelections.entries()) {
    // Match by amount and recent timestamp (within 1 hour)
    const isImageBundle = amount === 900 && selection.type === 'image';
    const isVideoBundle = amount === 1500 && selection.type === 'video';
    const isRecent = selection.timestamp > oneHourAgo;
    
    if ((isImageBundle || isVideoBundle) && isRecent) {
      return { ...selection, key };
    }
  }
  
  return null;
}

// NEW: Create product info for custom selections
function createCustomProductInfo(customSelection, amount) {
  const { selections, type } = customSelection;
  const isImage = type === 'image';
  
  const fileMap = {
    '1.png': '1NP2kWc03vozTlxWneaInrGIZo9XmEMUn',
    '2.png': '15QZUobKAfaOtRgIU7nTH-aYQIE19Qw9q',
    '3.png': '1wCuBXHbBgwzMBIliyPeOYtj18nl1ZTsL',
    '4.png': '1pFANqrEiLmMULrcqSKZidku-BaDliOTl',
    '5.png': '1QVfp-ENDpgfBy9dTx8tLRDIaa5FIjym_',
    '6.png': '1kJZ_NxFDvtpP8MLaEsc2jeLrJMcoUWXm',
    '7.png': '18fvjsf_VeVMjWzGcMj1XwGoXQWW_m4_l',
    '8.png': '12mWxSHu8t7l3Is1z1G_0-D1VzYdQaKnk',
    '9.png': '17yAz-W0o3vWWIB-a72pyIYAaduZSlxoo',
    '10.png': '1z-WGL792vfo_jiNzjdktvM9sJtrJrSic',
    '1.mp4': '1MqwU9kcoGJgCNw7Xaqr-RDwKZgz56mYy',
    '2.mp4': '1o2L5MSK53adayK4v_86Vv-DjaVCm-Wll',
    '3.mp4': '1c9juFIsWrlUSCEMPzlqb306Jsi2P_I9E',
    '4.mp4': '1OSUMX0XL-BgttCtEZVlGo7YM7zOW94Hp'
  };
  
  const downloads = selections.map(item => {
    const fileId = fileMap[item.filename];
    return {
      name: item.name,
      url: `https://drive.google.com/uc?export=download&id=${fileId}`,
      description: `High quality ${isImage ? 'image' : 'video'} download`
    };
  });
  
  // Add license
  downloads.push({
    name: 'Commercial License',
    url: 'https://drive.google.com/uc?export=download&id=1oFlNndenosC5aiPKvHxg8e9XjoDhTLCA',
    description: `Full commercial usage rights for all ${type}s`
  });
  
  return {
    type: `custom_${type}_bundle`,
    name: `Custom ${isImage ? 'Image' : 'Video'} Bundle`,
    description: `Your selected ${selections.length} ${isImage ? 'images' : 'videos'} with commercial license`,
    downloads
  };
}

// 🎨🎬 STANDARD PRODUCT CONFIGURATION
function getProductInfo(amountInCents) {
  const products = {
    
    // 🎨 $3.00 - Single Image
    300: {
      type: 'single_image',
      name: 'Premium AI Image',
      description: 'High-resolution AI-generated artwork with commercial license',
      downloads: [
        {
          name: 'High Resolution Image (8K)',
          url: 'https://drive.google.com/uc?export=download&id=1NP2kWc03vozTlxWneaInrGIZo9XmEMUn',
          description: 'Ultra-high quality artwork'
        },
        {
          name: 'Commercial License',
          url: 'https://drive.google.com/uc?export=download&id=1oFlNndenosC5aiPKvHxg8e9XjoDhTLCA',
          description: 'Full commercial usage rights'
        }
      ]
    },
    
    // 🎬 $5.00 - Single Video
    500: {
      type: 'single_video',
      name: 'Premium AI Video',
      description: 'High-quality AI motion graphics with commercial license',
      downloads: [
        {
          name: 'High Quality Video (4K)',
          url: 'https://drive.google.com/uc?export=download&id=1MqwU9kcoGJgCNw7Xaqr-RDwKZgz56mYy',
          description: '4K resolution, loop-ready format'
        },
        {
          name: 'Commercial License',
          url: 'https://drive.google.com/uc?export=download&id=1oFlNndenosC5aiPKvHxg8e9XjoDhTLCA',
          description: 'Full commercial usage rights'
        }
      ]
    }
  };

  return products[amountInCents];
}

// Email template
async function sendFulfillmentEmail(email, name, productInfo, orderId) {
  const downloadLinksHtml = productInfo.downloads.map(download => `
    <tr>
      <td style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 10px;">
        <strong style="color: #00d4ff;">${download.name}</strong><br>
        <small style="color: #666;">${download.description}</small><br>
        <a href="${download.url}" style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #8338ec); color: white; padding: 10px 20px; border-radius: 25px; text-decoration: none; margin-top: 8px; font-weight: bold;">
          📥 Download Now
        </a>
      </td>
    </tr>
  `).join('');

  const mailOptions = {
    from: `LiquidVibes Studio <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `🎨 Your ${productInfo.name} is Ready for Download!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your LiquidVibes Purchase</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #00d4ff, #ff006e, #8338ec); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 2.5rem; font-weight: bold;">LiquidVibes</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 1.1rem;">Premium AI Art Studio</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <h2 style="color: #333; margin-bottom: 20px;">🎉 Thank you for your purchase, ${name}!</h2>
            
            <div style="background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(255,0,110,0.1)); padding: 20px; border-radius: 15px; margin: 20px 0; border-left: 4px solid #00d4ff;">
              <h3 style="margin: 0 0 10px; color: #00d4ff;">📦 Your Order Details</h3>
              <p style="margin: 0;"><strong>${productInfo.name}</strong></p>
              <p style="margin: 5px 0; color: #666;">${productInfo.description}</p>
              <p style="margin: 5px 0; font-size: 0.9rem; color: #888;">Order ID: ${orderId}</p>
            </div>

            <h3 style="color: #333; margin: 30px 0 15px;">⬇️ Download Your Files</h3>
            <p style="color: #666; margin-bottom: 20px;">Click the buttons below to download your high-quality digital assets:</p>
            
            <table style="width: 100%; border-collapse: collapse;">
              ${downloadLinksHtml}
            </table>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 30px 0;">
              <h4 style="margin: 0 0 10px; color: #856404;">⚠️ Important Information</h4>
              <ul style="margin: 0; padding-left: 20px; color: #856404;">
                <li>Download links are valid for <strong>30 days</strong></li>
                <li>All images are <strong>ultra-high resolution</strong> with full commercial rights</li>
                <li>Videos are <strong>4K quality</strong> in loop-ready format</li>
                <li>Perfect for print, digital, and commercial projects</li>
                <li>Save files to your device immediately after download</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://your-website.com/gallery.html" style="display: inline-block; background: linear-gradient(135deg, #ff006e, #8338ec); color: white; padding: 15px 30px; border-radius: 50px; text-decoration: none; font-weight: bold; margin: 10px;">
                🎨 Browse More Art
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <div style="text-align: center; color: #666;">
              <p>Need help? Reply to this email or contact us at <a href="mailto:support@liquidvibes.com" style="color: #00d4ff;">support@liquidvibes.com</a></p>
              <p style="font-size: 0.9rem;">© 2024 LiquidVibes Studio - Premium AI Art & Automated Fulfillment</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LiquidVibes FREE Server running on port ${PORT}`);
  console.log(`📧 Email configured: ${process.env.GMAIL_USER ? '✅' : '❌'}`);
  console.log(`💳 Stripe configured: ${process.env.STRIPE_SECRET_KEY ? '✅' : '❌'}`);
  console.log(`🔗 Webhook secret configured: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅' : '❌'}`);
  console.log(`🆓 Running on FREE tier - Render.com`);
  console.log(`🎨 Custom bundle selections enabled ✅`);
  console.log(`📄 License PDF configured: 1oFlNndenosC5aiPKvHxg8e9XjoDhTLCA ✅`);
});
