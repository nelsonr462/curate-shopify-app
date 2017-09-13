$(document).ready(function() {
    var clickedRow
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
        "dom": '<"row buttonHolder" <"col-sm-4"f> <"col-sm-4 tableButtons" B> <"col-sm-4 correctedLength"l> > t <"row" <"col-sm-6"i> <"col-sm-6"p> >',
        "select": true,
        "buttons": ["selectAll", "selectNone", "selected"]
    })
    
    
    // REMOVE LOADING SCREEN
    // ....
    
    
    // CREATE SELECT2 DROPDOWN
    var groupSelect = $(".groupSelect").select2({
        placeholder: "Select a group",
        allowClear: false
    });

    var multiGroupSelect = $(".multiGroupSelect").select2({
        placeholder: "Select a group",
        allowClear: false
    })
    
    // MODAL LOADING
    $(function() {
        $('#groupModal').modal({
            keyboard: true,
            backdrop: "static",
            show: false,

        }).on('show.bs.modal', function(event) {                           //subscribe to show method
            var getIdFromRow = $(event.relatedTarget).parent().data('id'); //get the id from the clicked span's parent
            clickedRow = $(event.relatedTarget).parent()
            productTable.rows().deselect()                                 // de-select all other irrelevant rows
            productTable.row(clickedRow.attr("index")).select()            // select clicked row
            groupSelect.val(clickedRow.text().trim()).trigger("change")    // switch modal's select dropdown to current row's group
        });
        
        $('#multiGroupModal').modal({
            keyboard: true,
            backdrop: "static",
            show: false
        })
    });

    // EDIT SELECTED BUTTON
    productTable.button(2).text("Edit Selected")
    productTable.button(2).action(function(e, dt, button, config) {
        console.log("SELECTED: ")
        selectedIndexList = dt.rows( { selected: true } )[0]
        console.log(selectedIndexList)
        $("#multiGroupModal").modal("show")
        
    })
    
    // HIDE 'SELECT ALL' ON SEARCH
    $("[type='search']").on('input', function() {
        if($(this).val() != "" ) {
           $(".buttons-select-all").attr('disabled', true).addClass('disabled')
        } else {
            $(".buttons-select-all").attr('disabled', false).removeClass('disabled')
        }  
    })
    
    
    
    // SAVE FUNCTION
    // updateType:  0 = Single-row Update, 1 = Multi-row Update
    function updateTable (updateType, laddaButton, selector) {
        var editedProducts = []
        var l = Ladda.create(laddaButton)
        l.start()
        $(".cancelButton").prop("disabled", true)
        
        var newGroup = selector.val()
        var newGroupId = selector.children(":selected").attr("groupId")
        
        selector.prop("disabled", true)
        
        if(updateType == 0) {
            editedProducts.push(clickedRow.data("id"))
        } else {
           for (var i = 0; i < selectedIndexList.length; i++) {
                editedProducts.push($("[index='"+selectedIndexList[i]+"']").data("id"))
            } 
        }
        
        return new Promise( function(resolve, reject) {
            $.post("/saveProducts"+window.location.search, { productList: editedProducts, group: newGroup, groupId: newGroupId, _csrf: $("[name='_csrf']").val() }, function(data) {
                resolve(data)
            })
        }).then(function(data) {
            if(data.success == true) {
                if (updateType == 0) {
                    clickedRow.text(newGroup)
                    clickedRow.append(editButton)
                    clickedRow.attr("groupId", newGroupId)
                } else {
                    for (var i = 0; i < selectedIndexList.length; i++) {
                        $("[index='" + selectedIndexList[i] + "']").text(newGroup)
                        $("[index='" + selectedIndexList[i] + "']").append(editButton)
                        $("[index='" + selectedIndexList[i] + "']").attr("groupId", newGroupId)
                    }
                }
                console.log("Edited products: ")
                console.log(editedProducts)
                productTable.rows().invalidate().draw()
                showAlert(true)
            } else {
                showAlert(false)
            }

            $((updateType == 0 ? "#saveGroup" : "#saveMultiGroup")).button("reset")
            $(".cancelButton").prop("disabled", false)
            selector.prop("disabled", false)
            
            l.stop()
            $((updateType == 0 ? "#groupModal" : "#multiGroupModal")).modal("hide")

            editedProducts = []
        })
    }
    
    
    // SAVE SINGLE GROUP BUTTON
    $("#saveGroup").click(function(){
        updateTable(0, this, groupSelect)
    })
    
    
    // SAVE MULTIPLE GROUPS BUTTON
    $("#saveMultiGroup").click(function(){
        updateTable(1, this, multiGroupSelect)
    })
    
    function showAlert(success) {
        $(".alert").removeClass((success == true ? "alert-error" : "alert-success"))
            .addClass((success == true ? "alert-success" : "alert-danger"))
            .html((success == true ? "<strong>Product Groups saved!</strong>" : "<strong>Error:</strong> Woops! Try refreshing the page or contact support for assistance"))
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

