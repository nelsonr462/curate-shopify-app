const shopifyAPI = require('shopify-node-api')
const crypto = require("crypto")
const firebase = require("firebase-admin")
const fs = require("fs")
const path = require("path")
const db = firebase.database()
const ref = db.ref("stores")
const tools = require("./tools")

module.exports.verify = function(req, res, next) {
    var Shopify
    var session = req.session
    var params = req.query
    var shop = req.query.shop
    var currentThemes = []
    var liquidFile

    if (!shop) {
        res.errorT({
            message: "Unauthorized"
        })
    }
    else {
        shop = req.query.shop.replace(".myshopify.com", "")
    }

    var nonceRef = db.ref("stores/" + shop + "/nonce")
    
    // FETCH STORED NONCE AND CREATE TEMPORARY SHOPIFY API CLIENT
    nonceRef.once("value", function(data) {

        Shopify = new shopifyAPI({
            shop: shop + ".myshopify.com",
            shopify_api_key: process.env.API_KEY,
            shopify_shared_secret: process.env.API_SECRET,
            shopify_scope: "write_script_tags,read_script_tags,write_themes,read_themes,read_products,write_products",
            redirect_uri: "https://curate-app-dev.herokuapp.com/verify",
            nonce: data.val()
        })

        console.log("RETURNED NONCE: "+data.val())

    }).then(function() {
    // EXCHANGE FOR PERMANENT ACCESS TOKEN AND REMOVE NONCE
        return new Promise(function(resolve, reject) {
            Shopify.exchange_temporary_token(params, function(err, data) {
                console.log("ACCESS TOKEN "+data)
                var accessToken = tools.encrypt(data["access_token"])
                ref.child(shop).update({
                    access_token: accessToken,
                    nonce: null
                }).then(function() {
                    resolve()
                })
            })
        })

    }).then(function() {
    // CREATE AND SAVE NEW SETTINGS METAFIELD
        var settingsData = {
            "productPageMaxItems": 5,
            "checkoutPageMaxItems": 5,
            "productPageTitle": "You may also like...",
            "checkoutPageTitle": "Don't forget to check these out!",
            "visibility": 0,
            "showDefault": true
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


        return new Promise(function(resolve, reject) {
            Shopify.post('/admin/metafields.json', metafield, function(err, data, headers) {
                if (err) reject(console.log("Metafield Write Error: " + err))

                resolve(console.log("Returned Metafield Data:  " + data))
            })
        })

    }).then(function() {
    // FETCH SHOPIFY ACTIVE THEME IDS
        return new Promise(function(resolve, reject) {
            Shopify.get('/admin/themes.json', function(err, data, heades) {
                console.log("THEMES DATA: ")
                console.log(data)
                for(var i = 0; i < data.themes.length; i++) {
                    if(data.themes[i]["role"] != "unpublished") {
                        currentThemes.push(data.themes[i]["id"])
                    }
                }
                resolve(console.log("CURRENT THEMES: "+currentThemes))
                
            })
        })
    }).then(function() {
    // READ LIQUID FILE INTO STRING FOR INSTALL
        var filePath = path.join(__dirname, '..', 'public', 'install', 'curate.liquid')
    
        return new Promise(function(resolve, reject) {
            fs.readFile(filePath, 'utf8', function(err, data) {
                if(err) reject(err)
                liquidFile = data
                resolve()
            })
        })
        
    }).then(function() {
    // INSTALL LIQUID FILE INTO CURRENT ACTIVE THEMES
        var snippetsToSave = []
        var snippet = {
            "asset": {
                "key": "snippets\/curate.liquid",
                "value": liquidFile
            }
        }
        
        function addSnippet(themeId) {
            return new Promise(function(resolve, reject) {
                Shopify.put('/admin/themes/' + themeId + '/assets.json', snippet, function(err, data, headers) {
                    if(err) reject(err)
                    resolve(console.log("SNIPPET SAVED!"))
                }) 
            })
        }
        
        for(var i = 0; i < currentThemes.length; i++) {
            var newSnippet = addSnippet(currentThemes[i])
            snippetsToSave.push(newSnippet)
        }
        
        
        return Promise.all(snippetsToSave)
        
    }).then(function() {
        var uninstallWebhook = {
            "webhook" : {
                "topic" : "app\/uninstalled",
                "address" : "https:\/\/curate-app-dev.herokuapp.com\/uninstall?shop="+shop,
                "format" : "json"
            }
        }
        
        return new Promise(function(resolve, reject) {
            Shopify.post('/admin/webhooks.json', uninstallWebhook, function(err, data, headers) {
                if(err) reject(err)
                
                resolve(console.log("UNINSTALL WEBHOOK REGISTERED", data))
            })
        })
        
        
    }).then(function() {
    // START SESSION AND STORE SHOP
        session.shop = shop
        return res.redirect("http://" + shop + ".myshopify.com/admin/apps/" + process.env.API_KEY)
    }).catch(function(error) {
        res.errorT({
            message: "Woops! Something went wrong on our end! Please try again in a minute."
        })
        console.log(error)
    })


}

module.exports.install = function(req, res, next) {
    var redirect_uri = "https://curate-app-dev.herokuapp.com/verify"
    var api_key = process.env.API_KEY
    var nonce = crypto.randomBytes(20).toString('hex')
    var code = req.query.code
    var scopes = "write_script_tags,read_script_tags,write_themes,read_themes,read_products,write_products,write_orders,read_orders"
    var shop = req.query.shop
    var session = req.session
    
    // Temp auth code present, redirect to verification for permanent auth token
    if (code) {

        res.redirect("https://curate-app-dev.herokuapp.com/verify?shop=" + req.query.shop.replace(".myshopify.com", ""))

    // Request from Shopify admin dashboard, validate signature and redirect to dashboard    
    } else if (req.query.hmac && req.query.shop && req.query.timestamp) {
        
        var i = req.url.indexOf('?');
        var query = req.url.substr(i);
        session.query = req.query
        
        
        res.redirect("/dashboard")

    // Install from non-Shopify URL, begin OAuth 2.0 process, save new nonce
    } else if (req.query.shop && !req.query.hmac) {

        ref.child(shop).update({
            shop: shop,
            nonce: nonce
        }).then(function() {
            res.redirect("https://" + shop + ".myshopify.com/admin/oauth/authorize?client_id=" + api_key + "&scope=" + scopes + "&redirect_uri=" + redirect_uri + "&state=" + nonce)
        }).catch(function(error) {
            console.log("Failed to save object")
        })


    // New visitor, capture Shopify URL    
    } else {
        res.renderT('install', {
            template: 'install'
        })
    }
}

module.exports.index = function(req, res) {
    // const message = "hello world"
    var shop = req.query.shop
    var groups = []
    var products = []
    var appId = 0;

    // var io = req.app.get('io')
    // io.emit('call progress event', { message });

    res.renderT('settings', {
        template: 'settings',
        shop: shop,
        products: products,
        groups: groups,
        appId: appId
    })
}

module.exports.dashboard = function(req, res) {
    var productList = []
    var groups = []
    var groupIds = []
    var session = req.session
    var Shopify = session.shopify
    var shop = session.shop

    var productRef = db.ref("stores/" + shop + "/products")
    var groupRef = db.ref("stores/"+shop+"/groups")

    fetchAll(Shopify, productList, "products").then(function() {
        return new Promise(function(resolve, reject) {
            // If previous Promise returned error, skip Firebase request, no products to modify
            if(productList.length < 1) { resolve() }
            
            // Make Firebase request for groups to add to products fetched from Shopify
            productRef.once("value", function(data) {
                if(data.val() == null) {
                    resolve()
                } else {
                    // Match Firebase groups up with Shopify Products
                    for(var j = 0; j < productList.length; j++) {
                        var id = productList[j]["id"]
                        if(id in data.val()) {
                            productList[j]["group"] = data.val()[id]["group"]
                            productList[j]["groupId"] = data.val()[id]["id"]
                        } 
                    }
                    resolve()
                    // resolve(console.log(productList[0]))
                }
            })
        })
        
    }).then(function() {
        return new Promise(function(resolve, reject) {
            groupRef.once("value", function(data) {
                if (!data.val()) {
                    resolve()
                } else {

                    for (var key in data.val()) {
                        groups.push(key)
                        groupIds.push(data.val()[key]["id"])
                    }
    
                    // console.log("groups request: "+groups)
                    resolve()
                }
            })
        })
        
    }).then(function() {
        
        res.renderT('dashboard', {
            shop: shop,
            products: productList,
            groups: groups,
            groupIds: groupIds,
            appId: process.env.API_KEY,
            template: "dashboard",
            csrfToken: req.csrfToken()
        })
    }).catch(function(error) {
        res.errorT({
            message: error.message
        })
    })

}

module.exports.groups = function(req, res) {
    var productList = []
    var groupList = []
    var session = req.session
    var Shopify = session.shopify
    var shop = session.shop

    return fetchAll(Shopify, groupList, "groups").then(function() {
        return fetchAll(Shopify, productList, "productsNoGroups")
    }).then(function() {
        
        // console.log(productList)
        
        return res.renderT('groups', {
            shop: shop,
            products: productList,
            groups: groupList,
            appId: process.env.API_KEY,
            template: "groups",
            csrfToken: req.csrfToken()
        })
    }).catch(function(error) {
        res.errorT({
            message: error.message
        })
    })

}

module.exports.settings = function(req, res) {
    var session = req.session
    var Shopify = session.shopify
    var shop = session.shop
    var settingsData = {}
    
    return new Promise(function(resolve, reject) {
        return Shopify.get('/admin/metafields.json?namespace=shopifycrpSettings', function(err, data, headers) {
            if (err) console.log(err)
            resolve(data.metafields.forEach(function(group) {
                if (group.namespace.localeCompare("shopifycrpSettings") == 0) {
                    settingsData = group.value
                }

            }))

        })
    }).then(function() {
        res.renderT('settings', {
            template: 'settings',
            appId: process.env.API_KEY,
            shop: shop,
            settingsData: settingsData,
            csrfToken: req.csrfToken()
        })
    })

}

module.exports.help = function(req, res) {
    var session = req.session
    var shop = session.shop
    var Shopify = session.shopify
    var currentTheme = ""
    
    return new Promise(function(resolve, reject) {
        return Shopify.get('/admin/themes.json', function(err, data, headers) {
            if(err) {
                console.log(err)
                resolve()
            }
            
            resolve(data.themes.forEach(function(theme) {
                if(theme.role.localeCompare("main") == 0 ) {
                    currentTheme = theme
                }
            }))
        })
    }).then(function() {
        res.renderT('help', {
            template: 'help',
            appId: process.env.API_KEY,
            shop: shop,
            themeId: currentTheme.id
        })
    })
    
    
}

// New payment page
module.exports.makePayment = function(req, res) {
    var session = req.session
    var Shopify = session.shopify
    var shop = session.shop
    
    var paymentExists = req.paymentExists
    var paymentInfo = req.paymentInfo
    var paymentSuccess = {}
    
    if(paymentExists == true && paymentInfo["status"] == "active") {
        res.redirect('/dashboard')
    } else {
        
        newPayment(Shopify, shop, paymentSuccess)
        .then(function(paymentSuccess) {
            console.log("PAYMENT URL CHECK: " + paymentSuccess["confirmation_url"])
            return res.renderT('verifyPayment', {
                template: 'verifyPayment',
                paymentConfirmationUrl: paymentSuccess["confirmation_url"]
            })
        }).catch(function(error) {
            res.errorT({
                message: error.message
            })
        })
    }
}

// scope =
//     write_script_tags,read_script_tags,write_themes,read_themes,read_products,write_products,write_orders,read_orders


// Fetches all products/metafields with spaced out requests to remain under the API limit
function fetchAll(Shopify, itemList, fetchType) {
    var pages = 1
    var countUrl = (fetchType == "products" || fetchType == "productsNoGroups" ? '/admin/products/count.json' : '/admin/metafields/count.json?namespace=shopifycrpGroups')
    
    return new Promise(function(resolve, reject) {
        // Retrieve products with Title, Tags, Handle, and Description
        return Shopify.get(countUrl, function(err, data, headers) {
            // If error present, reject carry on
            if (err) {
                resolve(console.log(err))
            }

            // Add empty group "None" to all Products before fetching groups from Firebase
            pages = Math.ceil(data.count/250)
            resolve()//console.log("PAGE COUNT: "+pages))

        })
    }).then(function() {
        
        var currentPage = 1
        var fetchUrl = (fetchType == "products" || fetchType == "productsNoGroups" ? '/admin/products.json?fields=id,title,tags,handle,images,variants&limit=250&page=' : '/admin/metafields.json?namespace=shopifycrpGroups&page=')
        
        function getItemPage(pageNumber) {
            return new Promise(function(resolve, reject) {
                // Retrieve products with Title, Tags, Handle, and Description
                Shopify.get(fetchUrl+pageNumber, function(err, data, headers) {
                    // If error present, reject carry on
                    // console.log("PRODUCTCOUNT:")
                    // console.log(data.products.length)
                    
                    if (err) {
                        resolve(console.log(err))
                    }
                    
                    currentPage++
                    // Add empty group "None" to all Products before fetching groups from Firebase
                    return setTimeout(function() {
                        if(fetchType == "products" || fetchType == "productsNoGroups") {
                            resolve(data.products.forEach(function(product) {
                                // console.log("API_TESTING:  TITLE=" + product.title)
                                if(fetchType == "products") {
                                    product.group = "None"
                                    product.groupId = ""
                                }
                                itemList.push(product)
                            }))
                        } else if(fetchType == "groups") {
                            resolve(data.metafields.forEach(function(group) {
                                if (group.namespace.localeCompare("shopifycrpGroups") == 0) {
                                    // console.log("METAFIELD ADDED: " + group.namespace + "." + group.key)
                                    itemList.push(group)
                                }
                            }))
                        }
                    }, 100)

                })
            })
        }
        
        // waterfall
        var promise = Array.from({
            length: pages
        }).reduce(function(acc) {
            return acc.then(function(res) {
                return getItemPage(currentPage).then(function(result) {
                    res.push(result)
                    return res
                })
            })
        }, Promise.resolve([]))
        
        return promise
    })
}


// Charges a new user using Shopify Billing API
function newPayment(Shopify, shop, paymentSuccess) {
    var paymentInfo = {
        "recurring_application_charge": {
            "name": "Curate by Sleepless Apps",
            "price": 14.99,
            "return_url": "http:\/\/" + shop + ".myshopify.com/admin/apps/77c27996bba784447671f56a5754b234/activate",
            "test": false,
            "trial_days": 90
        }
    }
    
    return new Promise(function(resolve, reject) {
        Shopify.post("/admin/recurring_application_charges.json", paymentInfo, function(err, data, headers) {
            if(err != null) return reject(console.log(err))

            paymentSuccess = data["recurring_application_charge"]
            console.log("New Payment Object")
            console.log(paymentSuccess)
            resolve(paymentSuccess)
            
        })
    })
}