/**
 * StockX Product Data Extractor - Apify Actor
 * Professional scraper with built-in proxy rotation and anti-bot measures
 * 
 * Author: Fortyfour-Sneaker Tools
 * Version: 1.0.0
 */

import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset } from 'crawlee';

// Brand-specific size charts for validation
const BRAND_SIZE_CHARTS = {
    adidas: {
        infant: ['3K', '4K', '5K', '5.5K', '6K', '6.5K', '7K', '7.5K', '8K', '8.5K', '9K', '9.5K', '10K'],
        kids: ['10.5K', '11K', '11.5K', '12K', '12.5K', '13K', '13.5K', '1Y', '1.5Y', '2Y', '2.5Y', '3Y', '3.5Y', '4Y', '4.5Y', '5Y', '5.5Y', '6Y', '6.5Y', '7Y'],
        mens: ['3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18'],
        womens: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16']
    },
    nike: {
        infant: ['1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '10C'],
        kids: ['10.5C', '11C', '11.5C', '12C', '12.5C', '13C', '13.5C', '1Y', '1.5Y', '2Y', '2.5Y', '3Y', '3.5Y', '4Y', '4.5Y', '5Y', '5.5Y', '6Y', '6.5Y', '7Y'],
        mens: ['3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18'],
        womens: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16']
    },
    jordan: {
        infant: ['1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '10C'],
        kids: ['10.5C', '11C', '11.5C', '12C', '12.5C', '13C', '13.5C', '1Y', '1.5Y', '2Y', '2.5Y', '3Y', '3.5Y', '4Y', '4.5Y', '5Y', '5.5Y', '6Y', '6.5Y', '7Y'],
        mens: ['3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18'],
        womens: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15']
    },
    'new balance': {
        mens: ['4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '14.5', '15', '15.5', '16'],
        womens: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12']
    },
    crocs: {
        mens: ['4-5', '6-7', '8-9', '10-11', '12-13', '14-15'],
        womens: ['4-5', '6-7', '8-9', '10-11', '12-13']
    }
};

/**
 * Detect gender from product data
 */
function detectGender(product) {
    const title = (product.title || '').toLowerCase();
    const categories = JSON.stringify(product.categories || {}).toLowerCase();
    const gender = (product.gender || '').toLowerCase();
    
    if (title.includes('infant') || title.includes('baby') || title.includes('toddler')) {
        return 'infant';
    }
    if (title.includes('kids') || title.includes('youth') || title.includes('grade school') || 
        title.includes('ps') || title.includes('td') || gender === 'kids') {
        return 'kids';
    }
    if (title.includes('women') || title.includes('wmns') || title.includes('(w)') || 
        categories.includes('women') || gender === 'women') {
        return 'womens';
    }
    return 'mens';
}

/**
 * Get expected sizes for brand and gender
 */
function getExpectedSizes(brand, gender) {
    const brandLower = (brand || 'default').toLowerCase();
    const brandChart = BRAND_SIZE_CHARTS[brandLower] || BRAND_SIZE_CHARTS.nike;
    return brandChart[gender] || brandChart.mens || [];
}

/**
 * Validate sizes and find missing ones
 */
function validateSizes(variants, brand, detectedGender) {
    const availableSizes = variants
        .map(v => v.traits?.size)
        .filter(Boolean);
    
    const expectedSizes = getExpectedSizes(brand, detectedGender);
    const missingSizes = expectedSizes.filter(size => !availableSizes.includes(size));
    const unexpectedSizes = availableSizes.filter(size => !expectedSizes.includes(size));
    
    const completeness = expectedSizes.length > 0 
        ? (availableSizes.length / expectedSizes.length * 100).toFixed(1)
        : 0;
    
    return {
        detectedGender,
        expectedSizes,
        availableSizes,
        missingSizes,
        unexpectedSizes,
        totalExpected: expectedSizes.length,
        totalAvailable: availableSizes.length,
        completeness: parseFloat(completeness)
    };
}

/**
 * Main actor entry point
 */
await Actor.main(async () => {
    // Get input
    const input = await Actor.getInput();
    
    const {
        startUrls = [],
        maxRequestsPerCrawl = 100,
        validateSizes = true,
        includeMissingSizes = true,
        proxyConfiguration = { useApifyProxy: true },
    } = input;

    console.log('🚀 Starting StockX Product Scraper');
    console.log(`📊 URLs to process: ${startUrls.length}`);
    console.log(`✅ Size validation: ${validateSizes}`);
    console.log(`🔄 Proxy: ${proxyConfiguration.useApifyProxy ? 'Apify Proxy' : 'None'}`);

    // Create proxy configuration
    const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);

    // Statistics
    let stats = {
        processed: 0,
        successful: 0,
        failed: 0,
        totalVariants: 0
    };

    // Create crawler
    const crawler = new PlaywrightCrawler({
        proxyConfiguration: proxyConfig,
        maxRequestsPerCrawl,
        
        // Request handler
        async requestHandler({ request, page, log }) {
            const url = request.url;
            log.info(`Processing: ${url}`);
            
            try {
                // Wait for page to load
                await page.waitForLoadState('networkidle', { timeout: 30000 });
                
                // Get page content
                const content = await page.content();
                
                // Extract __NEXT_DATA__
                const nextDataMatch = content.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
                
                if (!nextDataMatch) {
                    log.error(`No __NEXT_DATA__ found on ${url}`);
                    stats.failed++;
                    return;
                }
                
                const nextData = JSON.parse(nextDataMatch[1]);
                const product = nextData?.props?.pageProps?.product;
                
                if (!product) {
                    log.error(`No product data found on ${url}`);
                    stats.failed++;
                    return;
                }
                
                // Extract trait values
                const traits = product.traits || [];
                const traitDict = {};
                traits.forEach(t => {
                    traitDict[t.name] = t.value;
                });
                
                // Build product data
                const productData = {
                    success: true,
                    id: product.id,
                    url: url,
                    name: product.name,
                    urlKey: product.urlKey,
                    title: product.title,
                    brand: product.brand,
                    description: product.description || '',
                    model: product.model,
                    condition: product.condition || 'New',
                    productCategory: product.productCategory,
                    browseVerticals: product.browseVerticals || [],
                    listingType: product.listingType || 'STANDARD',
                    primaryCategory: product.primaryCategory,
                    secondaryTitle: product.secondaryTitle,
                    contentGroup: product.contentGroup,
                    gender: product.gender,
                    tags: product.tags || [],
                    categories: product.categories || {},
                    
                    // Traits
                    styleCode: traitDict.Style || '',
                    colorway: traitDict.Colorway || '',
                    retailPrice: traitDict['Retail Price'] || '',
                    releaseDate: traitDict['Release Date'] || '',
                    
                    traits: traits,
                    media: product.media || {},
                    variants: product.variants || [],
                    
                    extractionMetadata: {
                        extractedAt: new Date().toISOString(),
                        extractorVersion: '1.0.0-apify',
                        url: url
                    }
                };
                
                // Size validation
                if (validateSizes && productData.variants.length > 0) {
                    const detectedGender = detectGender(productData);
                    const validation = validateSizes(
                        productData.variants,
                        productData.brand,
                        detectedGender
                    );
                    
                    productData.sizeValidation = validation;
                    
                    if (includeMissingSizes && validation.missingSizes.length > 0) {
                        productData.missingSizes = validation.missingSizes.map(size => ({
                            size,
                            status: 'missing',
                            note: 'Not available on StockX for this product'
                        }));
                    }
                    
                    log.info(`✓ ${productData.title}`);
                    log.info(`  Sizes: ${validation.totalAvailable}/${validation.totalExpected} (${validation.completeness}%)`);
                } else {
                    log.info(`✓ ${productData.title}`);
                }
                
                // Save to dataset
                await Dataset.pushData(productData);
                
                // Update stats
                stats.processed++;
                stats.successful++;
                stats.totalVariants += productData.variants.length;
                
            } catch (error) {
                log.error(`Failed to process ${url}: ${error.message}`);
                stats.processed++;
                stats.failed++;
                
                // Save error to dataset
                await Dataset.pushData({
                    success: false,
                    url: url,
                    error: error.message,
                    extractedAt: new Date().toISOString()
                });
            }
        },
        
        // Error handler
        failedRequestHandler({ request, log }) {
            log.error(`Request ${request.url} failed too many times`);
            stats.failed++;
        },
    });

    // Run the crawler
    await crawler.run(startUrls);

    // Log final statistics
    console.log('\n📊 Extraction Statistics:');
    console.log(`   Total processed: ${stats.processed}`);
    console.log(`   Successful: ${stats.successful}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Total variants: ${stats.totalVariants}`);
    console.log(`   Success rate: ${((stats.successful / stats.processed) * 100).toFixed(1)}%`);

    // Save stats
    await Actor.setValue('STATS', stats);
    
    console.log('\n✅ Actor finished!');
});
