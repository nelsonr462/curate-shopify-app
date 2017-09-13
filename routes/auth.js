const shopifyAPI = require("shopify-node-api")
const firebase = require("firebase-admin")
const crypto = require("crypto")
const db = firebase.database()
const tools = require("./tools")

module.exports.setSession = function(req, res, next) {
    var Shopify
    var session = req.session
    var params = session.query

    if(session.shop == null  && params == null ) {
        // Show session expired page
        return res.renderT('session-expired', {
            appId: "",
            shop: "",
            template: 'session-expired'
        })
    }
    var shop = (params.shop ? params.shop : session.shop)
    
    
    if (!shop) {
        res.errorT({
            message: "Unauthorized"
        })
    }
    

    
    if(req.query.shop != null && shop != req.query.shop) {
        shop = req.query.shop
    }
    
    shop = shop.replace(".myshopify.com", "")

    
    var tokenRef = db.ref("stores/" + shop + "/access_token")
    
    tokenRef.once("value", function(data) {
        var accessToken = tools.decrypt(data.val())
        
        Shopify = new shopifyAPI({
            shop: shop,
            shopify_api_key: process.env.API_KEY,
            shopify_shared_secret: process.env.API_SECRET,
            access_token: accessToken,
            backoff: 30,
            backoff_delay: 5000,
            verbose: false
        })

        if (Shopify.is_valid_signature(req.session.query, true)) {
            console.log("VALID SHOPIFY SIGNATURE")
            return true
        }
        else {
            console.log("INVALID SHOPIFY SIGNATURE")
            return false
        }

    }).then(function() {
        // var secret = Tokens().secretSync()
        // var token = Tokens().create(secret)
        
        req.shopify = Shopify
        req.shop = shop
        // req.token = token
        session.shopify = Shopify
        session.shop = shop
        // session.secret = secret
        next()
    }).catch(function(error) {
        res.errorT({
            error: error.message,
            message: "Unauthorized"
        })
    })
    
}

module.exports.enableSafariCookies = function(req, res) {
    res.renderT('enableSafariCookies', {
        template: 'enableSafariCookies'
    })
}

module.exports.checkPayment = function(req, res, next) {
    var session = req.session
    var shop = session.shop
    var Shopify = session.shopify 
    var paymentExists = false
    var paymentInfo = null
    
    var paymentRef = db.ref("stores/" + shop + "/paymentInfo")
    
    return paymentRef.once('value', function(snapshot) {
        if( snapshot.val() == null || snapshot.val()["status"] != "active" ) {
            console.log("INVALID SUBSCRIPTION", paymentInfo)
            // send to make payment page
            // maybe account for new user
            res.redirect('/payment')
        } else {
            paymentInfo = snapshot.val()
            req.paymentInfo = paymentInfo
            req.paymentExists = paymentExists
            // console.log("VALID SUBSCRIPTION: ", paymentInfo)
            next()
        }
        
        // next()
    })

    // If no charge, disable app
    // 1. Set store metafields to "no display"
    // 2. Redirect all page requests to make payment page to prevent exploit

    
}

module.exports.activatePayment = function(req, res) {
    var session = req.session
    var shop = session.shop
    var Shopify = session.shopify 
    
    var paymentRef = db.ref("stores/" + shop + "/paymentInfo")
    var paymentInfo = ""
    
    var chargeId = req.query["charge_id"]

    // Change back into promise, activate Shopify.post(...) in next promise
    return new Promise(function(resolve, reject) {
        Shopify.get('/admin/recurring_application_charges/' + chargeId + '.json', function(err, data, headers) {
            if(err) { res.redirect("https://"+shop+".myshopify.com/admin/apps") }
            
            console.log("Returned RAC data: ")
            console.log(data)
            paymentInfo = data.recurring_application_charge
            paymentRef.update(paymentInfo)
            
            if(paymentInfo["status"] != "accepted") return reject("Rejected/Error")
        
            console.log("ACCEPTED")
            
            return resolve()
            
        })
        
    }).then(function() {
        return new Promise(function(resolve, reject) {
            Shopify.post('/admin/recurring_application_charges/'+ chargeId + '/activate.json', paymentInfo, function(err, data, headers) {
                if(err) { res.redirect("https://"+shop+".myshopify.com/admin/apps") }

                paymentInfo = data.recurring_application_charge
                paymentRef.update(paymentInfo)
                
                if(paymentInfo["status"] != "active") return reject("Rejected/Error")
                
                console.log("ACTIVATED")
                res.redirect("/dashboard")
                return resolve()
                    
                
            })
        }) 
            
    }).catch(function(error) {
        console.log("DECLINED/ERROR", error)
        res.renderT('paymentDeclined', {
            template: 'paymentDeclined',
            appId: process.env.API_KEY,
            shop: shop
        })
    })
        
    
}
