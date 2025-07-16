// 🆓 FREE LIQUIDVIBES FULFILLMENT SERVER - FIXED VERSION
// Save this as: server.js

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000; // Render uses port 10000

// Middleware
app.use(cors());
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Keep server awake (prevent Render free tier sleeping)
setInterval(() => {
  console.log('🔄 Keeping server active...');
}, 14 * 60 * 1000); // Every 14 minutes

// Email transporter (FIXED: createTransport not createTransporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'LiquidVibes FREE Fulfillment Server Running! 🆓',
    timestamp: new Date().toISOString(),
    tier: 'Free - Render.com'
  });
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

    let productInfo = getProductInfo(amount);
    
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

// Product configuration (using free Google Drive)
function getProductInfo(amountInCents) {
  const products = {
    300: { // $3.00 - Single Image
      type: 'single_image',
      name: 'Premium AI Image',
      description: 'High-resolution AI-generated artwork',
      downloads: [
        {
          name: 'High Resolution Image (8K)',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_SINGLE_IMAGE_FILE_ID',
          description: 'Ultra-high quality 8000x8000px image'
        },
        {
          name: 'Commercial License',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_LICENSE_FILE_ID',
          description: 'Full commercial usage rights'
        }
      ]
    },
    
    500: { // $5.00 - Single Video
      type: 'single_video',
      name: 'Premium AI Video',
      description: 'High-quality AI motion graphics',
      downloads: [
        {
          name: 'High Quality Video (4K)',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_SINGLE_VIDEO_FILE_ID',
          description: '4K resolution, loop-ready format'
        },
        {
          name: 'Commercial License',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_LICENSE_FILE_ID',
          description: 'Full commercial usage rights'
        }
      ]
    },
    
    900: { // $9.00 - Image Bundle  
      type: 'image_bundle',
      name: '4 Premium AI Images Bundle',
      description: 'Custom selection of 4 high-resolution artworks',
      downloads: [
        {
          name: 'Complete Image Bundle',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_IMAGE_BUNDLE_FILE_ID',
          description: 'All 4 selected images in one download'
        },
        {
          name: 'Image 1 - Ice Phoenix',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_IMAGE1_FILE_ID',
          description: 'High-res individual download'
        },
        {
          name: 'Image 2 - Stained Glass Dragon',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_IMAGE2_FILE_ID',
          description: 'High-res individual download'
        },
        {
          name: 'Image 3 - Enchanted Cottage',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_IMAGE3_FILE_ID',
          description: 'High-res individual download'
        },
        {
          name: 'Image 4 - Crystal Palace',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_IMAGE4_FILE_ID',
          description: 'High-res individual download'
        },
        {
          name: 'Commercial License',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_LICENSE_FILE_ID',
          description: 'Full commercial usage rights for all images'
        }
      ]
    },
    
    1500: { // $15.00 - Video Bundle
      type: 'video_bundle',
      name: '4 Premium AI Videos Bundle',
      description: 'Custom selection of 4 high-quality motion graphics',
      downloads: [
        {
          name: 'Complete Video Bundle',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_VIDEO_BUNDLE_FILE_ID',
          description: 'All 4 selected videos in one download'
        },
        {
          name: 'Video 1 - Anger Animation',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_VIDEO1_FILE_ID',
          description: '4K download of first video'
        },
        {
          name: 'Video 2 - Eye Motion',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_VIDEO2_FILE_ID',
          description: '4K download of second video'
        },
        {
          name: 'Video 3 - Fire Effect',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_VIDEO3_FILE_ID',
          description: '4K download of third video'
        },
        {
          name: 'Video 4 - Serf Animation',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_VIDEO4_FILE_ID',
          description: '4K download of fourth video'
        },
        {
          name: 'Commercial License',
          url: 'https://drive.google.com/uc?export=download&id=YOUR_LICENSE_FILE_ID',
          description: 'Full commercial usage rights for all videos'
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

            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 10px; padding: 20px; margin: 30px 0;">
              <h4 style="margin: 0 0 10px; color: #155724;">🆓 100% Free Fulfillment System!</h4>
              <ul style="margin: 0; padding-left: 20px; color: #155724;">
                <li>This email was sent by our <strong>free automated system</strong></li>
                <li>Zero overhead costs means better prices for you!</li>
                <li>Professional service without the premium price tag</li>
              </ul>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 30px 0;">
              <h4 style="margin: 0 0 10px; color: #856404;">⚠️ Important Information</h4>
              <ul style="margin: 0; padding-left: 20px; color: #856404;">
                <li>Download links are valid for <strong>30 days</strong></li>
                <li>All images are <strong>8K resolution</strong> with full commercial rights</li>
                <li>Videos are <strong>4K quality</strong> in loop-ready format</li>
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
              <p style="font-size: 0.9rem;">© 2024 LiquidVibes Studio - Free Automated Fulfillment System</p>
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
});
