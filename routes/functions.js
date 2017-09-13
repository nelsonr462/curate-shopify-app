const shopifyAPI = require('shopify-node-api')
const crypto = require("crypto")
const firebase = require("firebase-admin")
const tools = require("./tools")
const db = firebase.database()
const ref = db.ref("stores")


module.exports.saveProducts = function(req, res) {
    var productList = req.body.productList
    var group = req.body.group
    var groupId = req.body.groupId
    var Shopify
    var productData = ""


    tools.initAndValidate(req).then(function(shopifyInstance) {
        Shopify = shopifyInstance
        
        var productPromises = []
        var index = 0
        
        var groupData = {
            name: group,
            id: groupId
        }

        var metafieldParams = {
            "namespace": "shopifycrpGroups",
            "key": "Group",
            "value": JSON.stringify(groupData),
            "value_type": "string"
        }

        var metafield = {
            "metafield": metafieldParams
        }
        
        function updateMetafield() {
            
            var id = productList[index]
            index++
            return new Promise(function(resolve, reject) {
                Shopify.post('/admin/products/' + id + '/metafields.json', metafield, function(err, data) {
                    if (err) reject()
                    return setTimeout(function() {
                        resolve(console.log("SHOPIFY PRODUCT METAFIELD UPDATED"))
                    }, 250)
                })
            })
            
        }
        
        var promise = Array.from({length: productList.length}).reduce(function (acc) {
            return acc.then(function(res) {
                return updateMetafield().then(function(result) {
                    res.push(result)
                    return res
                })
            })
        }, Promise.resolve([]))
        
        return promise

    }).then(function() {
        return new Promise(function(resolve, reject) {
            
            if(groupId == "") return resolve()
            
            return Shopify.get('/admin/metafields/' + groupId + '.json', function(err, data, headers) {
                if (err) console.log(err)
                console.log("RETURNED METAFIELD: ")
                console.log(data)
                productData = JSON.stringify(JSON.parse(data["metafield"]["value"]).products)
                resolve()
    
            })
        })
    }).then(function() {
        var productRef = db.ref("stores/" + Shopify.config.shop + "/products")
        
        function updateProduct(product) {
            return productRef.child(productList[product]).update({
                    "id": groupId,
                    "group": group,
                    "productList": productData
                }).then(function() {
                    return console.log("firebase updated")
                }, function(error) {
                    console.log(error)
                    res.errorT({
                        message: "database error. contact support for assistance."
                    })
                })
        }
        
        var firebaseUpdates = []
        for(var i = 0; i < productList.length; i++) {
            var update = updateProduct(i)
            firebaseUpdates.push(update)
        }
        
        return Promise.all(firebaseUpdates)

    }).then(function() {
        res.successT({
            message: "Request received"
        })
    }).catch(function(error) {
        res.errorT({
            message: error.message
        })
    })

}

module.exports.saveGroups = function(req, res) {
    var productList = req.body.productList
    var groups = req.body.groups
    var isNewGroup = req.body.isNewGroup
    var Shopify
    var savedGroups = []
    
    console.log("GROUP LENGTH: "+groups.length)


    tools.initAndValidate(req).then(function(shopifyInstance) {
        Shopify = shopifyInstance
        var groupRef = db.ref("stores/" + Shopify.config.shop + "/groups")
        
        if (isNewGroup == "true") {
            return new Promise(function(resolve, reject) {
                var groupData = {
                    "title": groups[0]["title"],
                    "products": productList
                }

                var metafieldParams = {
                    "namespace": "shopifycrpGroups",
                    "key": groups[0]["title"],
                    "value": JSON.stringify(groupData),
                    "value_type": "string"
                }


                var metafield = {
                    "metafield": metafieldParams
                }

                Shopify.post('/admin/metafields.json', metafield, function(err, data) {
                    if (err) reject(console.log("Error: " + err))

                    savedGroups.push(data["metafield"])
                    var key = groups[0]["title"]
                    var id = data["metafield"]["id"]
                    var fbGroup = {}
                    fbGroup[key] = {
                        "id": id.toString()
                    }

                    groupRef.update(fbGroup).then(function() {
                        resolve()
                    })
                })

            })

        } else if (isNewGroup == "false") {
            var updates = []

            function updateGroup(id, title) {
                return new Promise(function(resolve, reject) {
                    var groupValue = {
                        "title": title,
                        "products": productList
                    }
                    
                    var updateData = {
                        "id": id,
                        "value": JSON.stringify(groupValue),
                        "value_type": "string"
                    }
                    var update = {
                        "metafield": updateData
                    }
                    
                    
                    
                    Shopify.put('/admin/metafields/' + id + '.json', update, function(err, data) {
                        if (err) return reject(console.log(err))
                        return resolve()
                    })

                    
                })
            }

            for (var i = 0; i < groups.length; i++) {
                var newUpdate = updateGroup(groups[i]["id"], groups[i]["title"])
                updates.push(newUpdate)
            }

            return Promise.all(updates).catch(function(error) {
                res.errorT({
                    message: error.message
                })

            })

        }


    }).then(function() {
        var productRef = db.ref("stores/" + Shopify.config.shop + "/products")
        
        if(isNewGroup == "true") { return true } 
  
        var index = 0
        
        function updateFirebaseProduct() {
            if(index < groups.length) {
                var id = groups[index]["id"]
                var title = groups[index]["title"]
                index++
                // Get Firebase data for products containing the edited group
                return new Promise(function(resolve, reject) {
                    productRef.orderByChild("id").equalTo(id).once("value", function(snapshot) {
                        return snapshot
                    }).then(function(snapshot) {
                        // Update each product with the new group information
                        return snapshot.forEach(function(data) {
                            console.log("Record update called")
                            var update = {}
                            update[data.key] = {
                                "group": title,
                                "id": (id == null ? "" : id),
                                "productList": JSON.stringify(productList)
                            }
                            productRef.update(update)

                        })
                    }).then(function () {
                        resolve()
                    })
                   
                })
            } else {
                return new Promise(function(resolve, reject) {
                    reject()
                })
            }

        }

        // Create promises and push to array to be executed syncrhonously
        var promise = Array.from({
            length: groups.length
        }).reduce(function(acc) {
            return acc.then(function(res) {
                return updateFirebaseProduct().then(function(result) {
                    res.push(result)
                    return res
                })
            })
        }, Promise.resolve([]))

        
        return promise

    }).then(function() {
        global.gc()
        return res.successT({
            savedGroups: savedGroups,
            message: "Request received"
        })
    }).catch(function(error) {
        return res.errorT({
            message: error.message
        })
    })


}

module.exports.deleteGroups = function(req, res) {
    var groups = req.body.groups
    var fbData = []
    var Shopify
    var deletedGroups = []

    tools.initAndValidate(req).then(function(shopifyInstance) {
        Shopify = shopifyInstance
        
        var metafieldPromises = []

        function deleteMetafield(id) {
            return new Promise(function(resolve, reject) {
                Shopify.delete('/admin/metafields/' + id + '.json', function(err, data, headers) {
                    if (err) reject()
                    resolve()
                })
            })
        }


        for (var i = 0; i < groups.length; i++) {
            var newPromise = deleteMetafield(groups[i])
            metafieldPromises.push(newPromise)
        }

        return Promise.all(metafieldPromises).catch(function(error) {
            res.errorT({
                message: error.message
            })
        })

    }).then(function() {
        var groupRef = db.ref("stores/" + Shopify.config.shop + "/groups")
        var productRef = db.ref("stores/" + Shopify.config.shop + "/products")
        var promises = []

        function resetProducts(id) {
            return deleteGroup(id).then(function() {
                // Reset products to group : "None" and id : ""
                return new Promise(function(resolve, reject) {
                    productRef.orderByChild("id").equalTo(id).on("value", function(snapshot) {
                        resolve(snapshot.forEach(function(data) {
                            var reset = {}
                            reset[data.key] = {
                                "group": "None",
                                "id": ""
                            }
                            productRef.update(reset)
                        }))
                    })
                })
            })
        }

        function deleteGroup(id) {
            console.log("DeleteGroup Reached")
            // Delete Firebase Group/Id from database
            return new Promise(function(resolve, reject) {
                groupRef.orderByChild("id").equalTo(id).on("value", function(snapshot) {
                    resolve(snapshot.forEach(function(data) {
                        var deleteRef = groupRef.child(data.key)
                        deleteRef.remove()
                    }))
                })
            })
        }

        for (var i = 0; i < groups.length; i++) {
            var newPromise = resetProducts(groups[i])
            promises.push(newPromise)
        }


        return Promise.all(promises).catch(function(error) {
            res.errorT({
                message: error.message
            })
        })

    }).then(function() {
        res.successT({
            message: "Request received"
        })
    }).catch(function(error) {
        res.errorT({
            message: error.message
        })
    })

}

module.exports.saveSettings = function(req, res) {
    var newSettingsData = req.body.newSettingsData
    var Shopify

    tools.initAndValidate(req).then(function(shopifyInstance) {
        Shopify = shopifyInstance
        
        return new Promise(function(resolve, reject) {
            var metafieldParams = {
                "namespace": "shopifycrpSettings",
                "key": "Settings",
                "value": JSON.stringify(newSettingsData),
                "value_type": "string"
    
            }
    
            var metafield = {
                "metafield": metafieldParams
            }
            
            Shopify.post('/admin/metafields.json', metafield, function(err, data, headers) {
                if (err) reject(console.log("Metafield Write Error: " + err))

                resolve(console.log("Returned Metafield Data:  " + data))
            })
            
        })
    }).then(function() {
        res.successT({
            message: "New settings saved!"
        })
    }).catch(function(error) {
        res.errorT({
            messsage: "Settings save error",
            error: error
        })
    })
}

module.exports.getProductData = function(req, res) {
    var shop = req.query.shop
    var productId = req.query.productId
    var productData = {}
    
    if (!shop) {
        res.errorT({
            message: "Unauthorized"
        })
    }
    else {
        shop = req.query.shop.replace(".myshopify.com", "")
    }
    
    console.log("SHOP: "+shop)
    console.log("PRODUCT: "+productId)
    
    var listRef = db.ref("stores/" + shop + "/products/" + productId + "/productList")
    
    listRef.once("value", function(data) {
        console.log("RETURNED DATA: ")
        console.log(data.val())
        productData = data.val()
    }).then(function() {
        console.log("success returned")
        res.successT({
            productData: JSON.parse(productData)
        })
    }, function(error) {
        res.errorT({
            success: false,
            message: "query failed"
        })
    })
    
    
}


// UNINSTALL FINAL WEBHOOK
module.exports.uninstall = function(req, res) {
    if ('200' != req.get('x-kotn-webhook-verified')) {
        console.log('invalid signature for uninstall');
        res.status(204).send();
        return;
    }
    var shop = req.get('x-shopify-shop-domain');
    if (!shop) {
        console.log('missing shop header for uninstall');
        res.status(400).send('missing shop');
        return;
    }
    
    console.log("X REQUEST ID: "+req.get('x-request-id'))

    shop = req.query.shop
    console.log("Valid uninstall signature")
    
    // Delete firebase stuff
    var storeRef = db.ref("stores/" + shop)
    var uninstallRequest = db.ref("stores/" + shop + "/uninstallRequest")
    var uninstallId = req.get('x-request-id')
    var updates = {}
    
    uninstallRequest.once("value", function(data) {
        if(data.val() != null) {
            console.log('stored uninstallId: ' + data.val())
            
            if(uninstallId == data.val()) {
                console.log('invalid uninstall request id');
                return res.status(204).send();
            }
        }
        
        updates['/paymentInfo'] = null
        updates['/nonce'] = null
        updates['/access_token'] = null
        updates['/uninstallRequest'] = uninstallId
        
        storeRef.update(updates)
        
        return res.status(200).send()

    })
        
}
