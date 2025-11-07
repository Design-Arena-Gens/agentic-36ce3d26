import { NextRequest, NextResponse } from 'next/server'

interface CatalogItem {
  [key: string]: string | number
}

// Platform-specific field mappings
const PLATFORM_FIELDS = {
  amazon: {
    required: ['Product Name', 'Brand', 'Category', 'Price', 'MRP', 'SKU', 'Description', 'Key Features', 'Images'],
    optional: ['Weight', 'Dimensions', 'Color', 'Size', 'Material', 'HSN Code', 'GST']
  },
  flipkart: {
    required: ['Product Name', 'Brand', 'Category', 'Listing Price', 'MRP', 'Product ID', 'Description', 'Key Features', 'Product Image'],
    optional: ['Package Weight', 'Package Dimensions', 'Color', 'Size', 'Material', 'HSN Code']
  },
  meesho: {
    required: ['Product Name', 'Category', 'Price', 'Product Description', 'Product Images', 'Size', 'Color'],
    optional: ['Brand', 'Material', 'Weight', 'HSN Code', 'Return Policy']
  },
  myntra: {
    required: ['Product Name', 'Brand', 'Category', 'MRP', 'Selling Price', 'Style ID', 'Description', 'Size', 'Color', 'Images'],
    optional: ['Material', 'Care Instructions', 'Occasion', 'Pattern', 'Fit']
  }
}

function extractProductInfo(rawData: string): any {
  const lines = rawData.split('\n').filter(line => line.trim())
  const extracted: any = {}

  // Common patterns to extract
  const patterns = {
    name: /(?:product name|name|title)[\s:]+(.+?)(?:\n|$)/i,
    brand: /(?:brand|manufacturer)[\s:]+(.+?)(?:\n|$)/i,
    price: /(?:price|selling price|mrp)[\s:]+(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)/i,
    category: /(?:category|type)[\s:]+(.+?)(?:\n|$)/i,
    description: /(?:description|details)[\s:]+(.+?)(?:\n\n|$)/i,
    size: /(?:size)[\s:]+(.+?)(?:\n|$)/i,
    color: /(?:color|colour)[\s:]+(.+?)(?:\n|$)/i,
    material: /(?:material|fabric)[\s:]+(.+?)(?:\n|$)/i,
    weight: /(?:weight)[\s:]+(.+?)(?:\n|$)/i,
    sku: /(?:sku|product id|item code)[\s:]+(.+?)(?:\n|$)/i,
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = rawData.match(pattern)
    if (match) {
      extracted[key] = match[1].trim()
    }
  }

  return extracted
}

function generatePlatformListing(extractedData: any, platform: string): any {
  const listing: any = {}
  const fields = PLATFORM_FIELDS[platform as keyof typeof PLATFORM_FIELDS]

  // Map extracted data to platform fields
  const fieldMapping: any = {
    'Product Name': extractedData.name || '',
    'Brand': extractedData.brand || 'Generic',
    'Category': extractedData.category || '',
    'Price': extractedData.price || '',
    'Selling Price': extractedData.price || '',
    'Listing Price': extractedData.price || '',
    'MRP': extractedData.price ? (parseFloat(extractedData.price) * 1.2).toFixed(2) : '',
    'SKU': extractedData.sku || `SKU${Date.now()}`,
    'Product ID': extractedData.sku || `PID${Date.now()}`,
    'Style ID': extractedData.sku || `STYLE${Date.now()}`,
    'Description': extractedData.description || '',
    'Product Description': extractedData.description || '',
    'Key Features': extractedData.description ? extractedData.description.split('.').slice(0, 5).join('. ') : '',
    'Size': extractedData.size || '',
    'Color': extractedData.color || '',
    'Material': extractedData.material || '',
    'Weight': extractedData.weight || '',
    'Package Weight': extractedData.weight || '',
    'Images': '[Image URLs]',
    'Product Image': '[Image URLs]',
    'Product Images': '[Image URLs]',
  }

  // Fill required fields
  fields.required.forEach(field => {
    listing[`${platform.toUpperCase()}_${field.replace(/\s+/g, '_')}`] = fieldMapping[field] || '[REQUIRED]'
  })

  // Fill optional fields if data available
  fields.optional.forEach(field => {
    if (fieldMapping[field]) {
      listing[`${platform.toUpperCase()}_${field.replace(/\s+/g, '_')}`] = fieldMapping[field]
    }
  })

  return listing
}

function analyzeMessage(message: string): { intent: string; platforms: string[] } {
  const messageLower = message.toLowerCase()

  let intent = 'general'
  if (messageLower.includes('catalog') || messageLower.includes('listing') || messageLower.includes('product')) {
    intent = 'catalog'
  } else if (messageLower.includes('task') || messageLower.includes('remind') || messageLower.includes('schedule')) {
    intent = 'task'
  } else if (messageLower.includes('help') || messageLower.includes('how')) {
    intent = 'help'
  } else if (messageLower.includes('analyze') || messageLower.includes('check')) {
    intent = 'analyze'
  }

  const platforms: string[] = []
  if (messageLower.includes('amazon')) platforms.push('amazon')
  if (messageLower.includes('flipkart')) platforms.push('flipkart')
  if (messageLower.includes('meesho')) platforms.push('meesho')
  if (messageLower.includes('myntra')) platforms.push('myntra')

  if (platforms.length === 0 && intent === 'catalog') {
    platforms.push('amazon', 'flipkart', 'meesho', 'myntra')
  }

  return { intent, platforms }
}

export async function POST(req: NextRequest) {
  try {
    const { message, catalogData, rawData } = await req.json()

    const { intent, platforms } = analyzeMessage(message)

    let response = ''
    let updatedCatalog = null

    switch (intent) {
      case 'catalog':
        if (rawData) {
          const extracted = extractProductInfo(rawData)
          const newItem: any = { ...extracted }

          // Generate platform-specific fields
          platforms.forEach(platform => {
            const platformData = generatePlatformListing(extracted, platform)
            Object.assign(newItem, platformData)
          })

          updatedCatalog = [...(catalogData || []), newItem]

          response = `I've processed your product data and created listings for ${platforms.join(', ')}.

Product: ${extracted.name || 'New Product'}
${extracted.brand ? `Brand: ${extracted.brand}` : ''}
${extracted.price ? `Price: ₹${extracted.price}` : ''}

Generated fields for:
${platforms.map(p => `- ${p.toUpperCase()}: ${PLATFORM_FIELDS[p as keyof typeof PLATFORM_FIELDS].required.length} required fields filled`).join('\n')}

The catalog has been updated. Please review and add images, then download to use for listing.`
        } else {
          response = `To create product listings, please:
1. Upload your catalog file (Excel/CSV)
2. Switch to the Catalog Manager tab
3. Paste your raw product data in the text area
4. I'll automatically format it for ${platforms.length > 0 ? platforms.join(', ') : 'all platforms'}

Or you can tell me the product details and I'll help format them!`
        }
        break

      case 'analyze':
        if (catalogData && catalogData.length > 0) {
          const missingFields: string[] = []
          const item = catalogData[0]

          platforms.forEach(platform => {
            const fields = PLATFORM_FIELDS[platform as keyof typeof PLATFORM_FIELDS]
            fields.required.forEach(field => {
              const key = `${platform.toUpperCase()}_${field.replace(/\s+/g, '_')}`
              if (!item[key] || item[key] === '[REQUIRED]') {
                missingFields.push(`${platform}: ${field}`)
              }
            })
          })

          if (missingFields.length > 0) {
            response = `Analysis complete! Found ${missingFields.length} missing required fields:\n\n${missingFields.slice(0, 10).join('\n')}\n\nProvide the missing information and I'll update your catalog.`
          } else {
            response = `Great! Your catalog looks complete for ${platforms.join(', ')}. All required fields are filled. You're ready to list your products!`
          }
        } else {
          response = 'No catalog loaded. Please upload a catalog file first.'
        }
        break

      case 'help':
        if (message.toLowerCase().includes('requirement') || message.toLowerCase().includes('guideline')) {
          const platform = platforms[0] || 'amazon'
          const fields = PLATFORM_FIELDS[platform as keyof typeof PLATFORM_FIELDS]
          response = `${platform.toUpperCase()} Listing Requirements:

Required Fields:
${fields.required.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Optional but Recommended:
${fields.optional.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Tips:
- Use high-quality images (minimum 1000x1000px)
- Write detailed descriptions with keywords
- Include accurate measurements and specifications
- Add all relevant attributes for better discoverability`
        } else {
          response = `I'm JARVIS, your personal AI assistant! I can help you with:

📋 Daily Tasks:
- Task reminders and scheduling
- Quick notes and organization
- Daily planning

🛒 E-commerce Catalog Management:
- Format product data for Amazon, Flipkart, Meesho, Myntra
- Auto-fill catalog sheets with product information
- Check for missing required fields
- Generate platform-specific listings

📦 How to use:
1. Upload your catalog Excel file
2. Paste raw product data in the Catalog Manager
3. I'll automatically format it for all platforms
4. Download the updated catalog

Just ask me anything or paste your product data!`
        }
        break

      case 'task':
        response = `Task Management:

I can help you with:
- Set reminders: "Remind me to check inventory at 3 PM"
- Daily schedule: "What's on my agenda today?"
- Quick tasks: "Add checking Amazon orders to my todo list"

For catalog-related tasks, switch to the Catalog Manager tab and I'll help you process your product listings efficiently!`
        break

      default:
        response = `Hello! I'm JARVIS, ready to assist you. I can help with:

- Daily task management and reminders
- E-commerce catalog processing for Amazon, Flipkart, Meesho, and Myntra
- Product listing preparation and data formatting

What would you like help with today?`
    }

    return NextResponse.json({ response, updatedCatalog })
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      { response: 'I apologize, but I encountered an error processing your request. Please try again.' },
      { status: 500 }
    )
  }
}
