const shopifyAPI = require('shopify-node-api')
const token = "59e1bf84fbbd3d6c83f12691d94e63f0"

module.exports.index = function(req, res) {
    res.successT({
        message: "Hello world!"
    })
}

module.exports.metafields = function(req, res) {
    var start = new Date()
    var Shopify = new shopifyAPI({
        shop: "sleepless-playground.myshopify.com",
        shopify_api_key: process.env.API_KEY,
        shopify_shared_secret: process.env.API_SECRET,
        access_token: token,
        backoff: 30,
        backoff_delay: 5000
    })

    return new Promise(function(resolve, reject) {
        Shopify.get('/admin/metafields.json?namespace=shopifycrpGroups&page=1', function(err, data, headers) {
            if (err) reject(console.log("METAFIELD ERROR: " + err))

            resolve(console.log("API:  METAFIELDS RETRIEVED"))
        })
    }).then(function() {
        var end = new Date() - start

        res.successT({
            time: end + " ms elapsed"
        })
    })
}

module.exports.writeMeta = function(req, res) {
    var settingsData = {
        "productPageMaxItems": 5,
        "checkoutPageMaxItems": 5,
        "visibility": 0,
        "productPageTitle": "You may also like...",
        "checkoutPageTitle":"Don't forget to check these out!"
    }

    var metafieldParams = {
        "namespace": "shopifycrpSettings",
        "key": "Settings",
        "value": JSON.stringify(settingsData),
        "value_type": "string"

    }

    var metafield = {
        "metafield": metafieldParams
    }

    console.log("SETTINGS DATA:  " + JSON.stringify(settingsData))


    var Shopify = new shopifyAPI({
        shop: "sleepless-playground.myshopify.com",
        shopify_api_key: process.env.API_KEY,
        shopify_shared_secret: process.env.API_SECRET,
        access_token: token,
        backoff: 30,
        backoff_delay: 5000
    })


    return new Promise(function(resolve, reject) {
        console.log("Promise reached")

        Shopify.post('/admin/metafields.json', metafield, function(err, data, headers) {
            if (err) reject(console.log("Metafield Write Error: " + err))

            resolve(console.log("Returned Metafield Data:  " + data))
        })
    }).then(function() {
        res.successT()
    })


}

module.exports.delete = function(req, res) {
    var Shopify = new shopifyAPI({
        shop: "sleepless-playground.myshopify.com",
        shopify_api_key: process.env.API_KEY,
        shopify_shared_secret: process.env.API_SECRET,
        access_token: token,
        backoff: 30,
        backoff_delay: 5000
    })

    return new Promise(function(resolve, reject) {
        Shopify.delete('/admin/metafields/27300902721.json', function(err, data, headers) {
            if (err) reject(console.log("METAFIELD ERROR: " + err))

            resolve(console.log("API:  METAFIELDS DELETED"))
        })
    }).then(function() {
        res.successT()
    })
}


module.exports.writeGroup = function(req, res) {
    var productIds = [6950665153, 7077035649]
    var products = [{
        "productTitle": "Awesomeness"
    }, {
        "productTitle": "More Awesomeness"
    }]
    var groupData = {
        "title": "TestGroup",
        "products": products,
        "productIds": productIds
    }

    var metafieldParams = {
        "namespace": "shopifycrpGroups",
        "key": "TestGroup",
        "value": JSON.stringify(groupData),
        "value_type": "string"

    }

    var metafield = {
        "metafield": metafieldParams
    }

    console.log("GROUP DATA:  " + JSON.stringify(groupData))


    var Shopify = new shopifyAPI({
        shop: "sleepless-playground.myshopify.com",
        shopify_api_key: process.env.API_KEY,
        shopify_shared_secret: process.env.API_SECRET,
        access_token: token,
        backoff: 30,
        backoff_delay: 5000
    })


    return new Promise(function(resolve, reject) {
        console.log("Promise reached")

        Shopify.post('/admin/metafields.json', metafield, function(err, data, headers) {
            if (err) reject(console.log("Metafield Write Error: " + err))

            resolve(console.log(data))
        })
    }).then(function() {
        res.successT()
    })


}