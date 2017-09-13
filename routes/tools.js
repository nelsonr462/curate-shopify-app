const crypto = require("crypto")
const algorithm = 'aes-256-ctr'
const password = 'sleeplessMedia007'
const firebase = require("firebase-admin")
const db = firebase.database()
const shopifyAPI = require('shopify-node-api')


      
module.exports = {
    encrypt : function (text) {
        var cipher = crypto.createCipher(algorithm, password)
        var crypted = cipher.update(text, 'utf8', 'hex')
        crypted += cipher.final('hex');
        return crypted;
    },
    
    decrypt : function (text) {
          var decipher = crypto.createDecipher(algorithm, password)
          var dec = decipher.update(text, 'hex', 'utf8')
          dec += decipher.final('utf8');
          return dec;
    },
    
    initAndValidate : function(req) {
        return new Promise(function(resolve, reject) {
            var shopifyInstance
            var tokenRef
            var shop = req.session.shop
            
            if (!shop) { reject(new Error("Unauthorized request")) }

            shop = shop.replace(".myshopify.com", "")
            
            tokenRef = db.ref("stores/" + req.session.shop + "/access_token")
            
            tokenRef.once("value", function(data) {
                var accessToken = module.exports.decrypt(data.val())
                shopifyInstance = new shopifyAPI({
                    shop: req.session.shop,
                    shopify_api_key: process.env.API_KEY,
                    shopify_shared_secret: process.env.API_SECRET,
                    access_token: accessToken,
                    backoff: 30,
                    backoff_delay: 3000
                })
                
                if (shopifyInstance.is_valid_signature(req.session.query, true)) {
                    console.log("VALID SHOPIFY SIGNATURE")
                    resolve(shopifyInstance)
                    
                } else {
                    console.log("INVALID SHOPIFY SIGNATURE")
                    reject(new Error("Unauthorized Request"))
                }
                
            })
        })
    }
    
}
