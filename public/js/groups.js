$(document).ready(function() {
    var tableLength = $("tbody").children().length
    var clickedRow
    var preselect
    var selectedIndexList
    var editButton = "<span class=\"editButton glyphicon glyphicon-edit\" data-toggle=\"modal\" data-target=\"#groupModal\"></span>"
    var clicked = false

    // ADD CSRF
    $.ajaxSetup({
        headers: { "X-CSRF-Token": $("[name='_csrf']").val() }
    });
    
    // Set default nav link behavior
    $("#navbar ul li a").click(function(event) {
        if (clicked == true) event.preventDefault()
        return clicked = true
    })
    
    // THEN ------

    // DEFINE TABLE
    var productTable = $('#products').DataTable({
        "dom": '<"row buttonHolder" <"col-sm-3"f> <"col-sm-6 tableButtons" B> <"col-sm-3 correctedLength"l> > t <"row" <"col-sm-6"i> <"col-sm-6"p> >',
        "select": true,
        "buttons": [{text: "Create Group"}, "selectAll", "selectNone", "selected", "selected"]
    })
    
    
    // REMOVE LOADING SCREEN
    // ....
    // FORMAT SELECT2 DROPDOWN
    function formatProduct(product) {
        console.log("FORMATTING: ")
        console.log(product)
        if(!product.id) { return product.text }
        var $productData = JSON.parse(product.element.attributes[0].value)
        var $product = $( "<img class='optionImage' src='" + $productData.productImage + "'><span>" + product.text + "</span>")
        return $product
        
    }
    
    // CREATE SELECT2 DROPDOWN
    var groupSelect = $(".groupSelect").select2({
        placeholder: "Select products",
        maximumSelectionLength: 6,
        allowClear: false,
        templateResult: formatProduct
    });

    var multiGroupSelect = $(".multiGroupSelect").select2({
        placeholder: "Select products",
        maximumSelectionLength: 6,
        allowClear: false,
        templateResult: formatProduct
    })
    
    console.log(groupSelect)
    
    // MODAL LOADING
    $(function() {
        $('#groupModal').modal({
            keyboard: true,
            backdrop: "static",
            show: false,

        }).on('show.bs.modal', function(event) {                           //subscribe to show method
            if(!preselect) return
            var getIdFromRow = $(event.relatedTarget).parent().data('id'); //get the id from the clicked span's parent
            clickedRow = $(event.relatedTarget).parent()
            productTable.rows().deselect()                                 // de-select all other irrelevant rows
            productTable.row(clickedRow.attr("index")).select()            // select clicked row
            
            // Get products contained in group
            var groupProducts = clickedRow.text().trim()
            groupProducts = groupProducts.replace(/[\n\r\t\f]/g, '')
            groupProducts = groupProducts.split(', ')
            for(var i = 0; i < groupProducts.length; i++) {
                groupProducts[i] = groupProducts[i].trim()
            }
            // Pre-select products already present in group
            groupSelect.val(groupProducts).trigger("change")    
            
            //  onChange listener to enable save button
            $("#saveGroup").prop("disabled", true)
            groupSelect.on("change", function(event) {
                $("#saveGroup").prop("disabled", false)
                
            })
            
        });
        
        $('#multiGroupModal').modal({
            keyboard: true,
            backdrop: "static",
            show: false
        })
        
        $('#deleteGroupModal').modal({
            keyboard: true,
            backdrop: "static",
            show: false
        })
    });
    
    // CREATE BUTTON
    productTable.button(0).action(function(e, dt, button, config) {
        // De-select other rows to avoid confusion
        productTable.rows().deselect() 
        preselect = false
        // console.log("clickedrow cleared")
        
        // Change visibility on elements in modal
        $("#editTitle").css("display", "none")
        $("#saveGroup").css("display", "none")
        $("#createTitle").css("display", "inherit")
        $("#newGroupDetails").css("display", "inherit")
        $("#saveNewGroup").css("display", "inline")
        $("#groupModal").modal("show")
        // Bring up single group modal
        
    })

    // EDIT SELECTED BUTTON
    productTable.button(3).text("Edit Selected")
    productTable.button(3).action(function(e, dt, button, config) {
        selectedIndexList = dt.rows( { selected: true } )[0]
        $("#multiGroupModal").modal("show")
        
    });
    
    // DELETE BUTTON
    productTable.button(4).text("Delete Selected")
    productTable.button(4).action(function(e, dt, button, config) {
        selectedIndexList = dt.rows( { selected: true})[0]
        $("#deleteGroupModal").modal("show")
    })
    
    $("td").on("click", ".editButton", function() {
        preselect = true
    })
    
    
    // SAVE FUNCTION
    // updateType: 0 = Create new Group, 1 = Single-row Update, 2 = Multi-row Update
    function updateTable (updateType, laddaButton, selector) {
        var isNewGroup = false
        var editedGroups = []
        var productList = []
        var productTitles = []
        var usedTitles = []
        
        // Get group names to prevent duplicates costing an API call
        $(".groupTitle").each(function() {
            usedTitles.push($(this).text())
        })
        
        // Reset possible input error
        if(updateType == 0) {
            $("[for='groupName']").removeClass("has-error")
            $(".nameWarning").css("display", "none")
        }
        
        // Create loading button and start loading animation
        var l = Ladda.create(laddaButton)
        l.start()
        $(".cancelButton").prop("disabled", true)
        
        // Get selected products names
        var newProducts = selector.val()
        
        
        // Fetch products and their Ids to add to productList
        if(newProducts !== null && newProducts !== "") {
            productList = selector.children(":selected").map(function(){return JSON.parse($(this).attr("productData"))}).get()
        } else {
            newProducts = ""
            productList = []
        }
        // Disable selector
        selector.prop("disabled", true)
        
        // Get new group name
        // Make save request
        // Get returned data for id
        // Save on Firebase
        // Create new row
        // Invalidate table data and redraw
        

        // Collect edited groups and their ids
        // Single edited group
        if(updateType == 1) {
            var editedGroup = {
                   "title": clickedRow.data("id").title,
                   "id": clickedRow.attr("groupId")
               }
            
            editedGroups.push(editedGroup)
            
        // Multiple edited groups    
        } else if(updateType == 2) {
           for (var i = 0; i < selectedIndexList.length; i++) {

               var editedGroup = {
                   "title": $("[index='" + selectedIndexList[i] + "']").data("id").title,
                   "id": $("[index='" + selectedIndexList[i] + "']").attr("groupId")
               }

               editedGroups.push(editedGroup)
           }
           
        // New Group, check for valid unique name
        } else if(updateType == 0) {
           if($("#groupName").val() == "") {
               $("[for='groupName']").addClass("has-error")
               $(".nameWarning").text("Please enter a name for the group")
               $(".nameWarning").css("display", "inline")
               
               cleanUp()
               
               return
               
           }  else if(usedTitles.indexOf($("#groupName").val()) > -1) {
               
               $("[for='groupName']").addClass("has-error")
               $(".nameWarning").text("Please make sure the group's name is unique")
               $(".nameWarning").css("display", "inline")
               
               cleanUp()
               return
           }
           
           isNewGroup = true
           editedGroups.push({
               "title": $("#groupName").val().toString(),
               "id": ""
           })
       }
       
        // POST request to server
        return new Promise( function(resolve, reject) {

            $.post("/saveGroups"+window.location.search, { productList: productList, groups: editedGroups, isNewGroup: isNewGroup, query: window.location.search, _csrf: $("[name='_csrf']").val()}, function(data) {
                console.log(data)
                resolve(data)
            })
            
        }).then(function(data) {
            // After successful POST, update table with new values
            if(data.success == true) {
                if (updateType == 1) {
                    clickedRow.text(newProducts.toString().replace(/,/g, ', '))
                    clickedRow.append(editButton)
                } else if(updateType == 2) {
                    for (var i = 0; i < selectedIndexList.length; i++) {
                        $("[index='" + selectedIndexList[i] + "']").text(newProducts.toString().replace(/,/g, ', '))
                        $("[index='" + selectedIndexList[i] + "']").append(editButton)
                    }
                } else if(updateType == 0) {
                    location.reload()
                }
    
                // Redraw table with new values
                productTable.rows().invalidate().draw()
                showAlert(true)
            } else {
                showAlert(false)
            }
            
            cleanUp()
            
            selector.val(null).trigger("change")
            $((updateType < 2 ? "#groupModal" : "#multiGroupModal")).modal("hide")
            
            setTimeout(function() {
                $("#editTitle").css("display", "inherit")
                $("#saveGroup").css("display", "inline")
                $("#createTitle").css("display", "none")
                $("#newGroupDetails").css("display", "none")
                $("#saveNewGroup").css("display", "none")
            }, 500)
            
            // clear editedgroups variable
            editedGroups = []
        }).catch(function(error) {
            alert(error)
        })
        
        function cleanUp(){
            $(".cancelButton").prop("disabled", false)
            selector.prop("disabled", false)
            $("#groupName").val("")
            l.stop()
            
            
        }
    }
    
    // DELETE FUNCTION
    function deleteGroups() {
        var deletedGroups = []
        
        for(var i = 0; i < selectedIndexList.length; i++) {
            deletedGroups.push($("[index='" + selectedIndexList[i] + "']").attr("groupId"))
        }
        
        return new Promise(function(resolve, reject) {
            $.post("/deleteGroups"+window.location.search, { groups: deletedGroups, _csrf: $("[name='_csrf']").val() }, function(data) {
                resolve(data)
            })
        }).then(function(data) {
            console.log("REQUEST RECEIVED: ")
            console.log(data)
            $("#deleteGroupModal").modal("hide")
            location.reload()
        })
        
    }
    
    // SAVE NEW GROUP BUTTON
    $("#saveNewGroup").click(function() {
        updateTable(0, this, groupSelect)
    })
    
    
    // SAVE SINGLE GROUP BUTTON
    $("#saveGroup").click(function(){
        updateTable(1, this, groupSelect)
    })
    
    
    // SAVE MULTIPLE GROUPS BUTTON
    $("#saveMultiGroup").click(function(){
        updateTable(2, this, multiGroupSelect)
    })
    
    // DELETE BUTTON
    $("#deleteGroup").click(function() {
        var l = Ladda.create(this)
        l.start()
        $(".cancelButton").prop("disabled", true)
        deleteGroups()
    })
    
    // CANCEL BUTTON RESET
    $(".cancelButton").click(function() {
        setTimeout(function() {
            $("[for='groupName']").removeClass("has-error")
            $(".nameWarning").css("display", "none")
            $("#editTitle").css("display", "inherit")
            $("#saveGroup").css("display", "inline")
            $("#createTitle").css("display", "none")
            $("#newGroupDetails").css("display", "none")
            $("#saveNewGroup").css("display", "none")
            groupSelect.val(null).trigger("change")
        }, 500)
    })
    
    function showAlert(success) {
        $(".alert").removeClass((success == true ? "alert-error" : "alert-success"))
            .addClass((success == true ? "alert-success" : "alert-danger"))
            .html((success == true ? "<strong>Groups saved!</strong>" : "<strong>Database Error:</strong> Woops! Something went wrong! Please contact support for assistance"))
            .css("opacity", 1)
            
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                $(".alert").animate({
                    opacity: 0
                }, 500)
                resolve()
            }, 3000)
        })
    }
    
})


// 2 Max Item Attributes (Product Page, Checkout Page), 2 Titles ( Product, Checkout + Hidden Default),  2 Display Attributes (Product, Checkout), 
