// Serverless Function: /api/analyze
// Compatible with Vercel and Netlify Serverless Functions (Node.js)

export default async function handler(req, res) {
  // Set CORS headers so it can be called cleanly
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image, mimeType } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: 'No image provided in request body.' });
    }

    // Securely retrieved from your private environment variable on Vercel/Netlify
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY environment variable is not configured on the server.',
        help: 'Add GEMINI_API_KEY in your Vercel or Netlify project settings.'
      });
    }

    // Clean base64 prefix if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;
    const mediaType = mimeType || 'image/jpeg';

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `You are an expert Indian fashion stylist and e-commerce product matcher.
Look closely at the outfit worn in this photograph.
Analyze and isolate every specific clothing item, shoe, bag, and accessory visible.

Generate a strictly valid JSON response in this exact format:
{
  "outfitTitle": "Short stylish title describing the look (e.g. Oversized Leather Biker Chic, Monochromatic Linen Minimalist)",
  "aestheticVibe": "Key aesthetic (e.g. Downtown Girl, Office Siren, Old Money, Coquette, Tomato Girl)",
  "pieces": [
    {
      "category": "Outerwear/Top/Bottom/Dress/Footwear/Bag/Jewelry",
      "name": "Exact garment name (e.g. Chocolate Brown Cropped Leather Jacket)",
      "searchQuery": "Precise 3-4 word shopping search term for Indian stores (e.g. brown cropped leather jacket women)",
      "description": "Details on fit, collar, cut, and material (e.g. Boxy fit, lapel collar, silver zip)",
      "estimatedPrice": "Estimated price range in India (e.g. ₹1,499 - ₹2,999)"
    }
  ]
}

Be specific about colors, silhouettes, and fabrics so the search queries find near-identical pieces on Myntra, Ajio, and Zara India.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mediaType,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API call failed:', errText);
      return res.status(502).json({ error: 'Failed to communicate with Vision AI', details: errText });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({ error: 'No output received from Vision AI' });
    }

    const parsedResult = JSON.parse(candidateText);
    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
