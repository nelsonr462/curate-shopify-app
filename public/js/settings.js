// Fetch current settings data and prepare visibility settings
var settingsData = JSON.parse($("#dataHolder").attr("data"))
var newSettingsData = {}
var visibilitySettings = ["Product", "Cart", "Product and Cart", "None"]
var clicked = false

// ADD CSRF
$.ajaxSetup({
    headers: { "X-CSRF-Token": $("[name='_csrf']").val() }
});

// Make nice checkbox
$("#showDefault").bootstrapSwitch({
    size: "small"
})

// Display settings data
$("#productPageTitle").val(settingsData.productPageTitle)
$("#checkoutPageTitle").val(settingsData.checkoutPageTitle)
$("#productPageMaxItems").val(settingsData.productPageMaxItems).change()
$("#checkoutPageMaxItems").val(settingsData.checkoutPageMaxItems).change()
$("#visibilitySettings").val(visibilitySettings[settingsData.visibility]).change()
$("#showDefault").bootstrapSwitch("state", $.parseJSON(settingsData.showDefault), true)

$(document).ready(function() {
    // Set default nav link behavior
    $("#navbar ul li a").click(function(event) {
        if (clicked == true) event.preventDefault()
        return clicked = true
    })
    
    // Load Settings Modal
    $(function() {
        $('#saveSettingsModal').modal({
            keyboard: true,
            backdrop: "static",
            show: false
        })
    })
    
    // Load Subscription Modal
    $(function() {
        $("#manageSubscriptionModal").modal({
            keyboard: true,
            backdrop: "static",
            show: false
        })
    })

    // Disable both save buttons because no changes exist yet    
    $(".saveSettings").prop("disabled", true)
    
    // Enable button and modal popup when user makes change
    $(".form-control").change(function() {
        $(".saveSettings").prop("disabled", false)
        $(".settingsContainer").mouseleave(function() {
            $("#saveSettingsModal").modal("show")
        })
        $("#navbar ul li a").click(function(event) {
            event.preventDefault()
            $("#saveSettingsModal").modal("show")
        })
    })
    
    // Save new settings function
    $(".saveSettings").click(function() {
        var l = Ladda.create(this)
        l.start()
        $(".cancelButton").prop("disabled", true)
        $(".saveSettings").prop("disabled", true)
        $(".settingsContainer").off("mouseleave")
        $("#navbar ul li a").off("click")
        newSettingsData.productPageTitle = $("#productPageTitle").val()
        newSettingsData.checkoutPageTitle = $("#checkoutPageTitle").val()
        newSettingsData.productPageMaxItems = $("#productPageMaxItems").val()
        newSettingsData.checkoutPageMaxItems = $("#checkoutPageMaxItems").val()
        newSettingsData.visibility = $("#visibilitySettings option:selected").attr("data")
        newSettingsData.showDefault = $("#showDefault").bootstrapSwitch('state')
        
        // Send post to server
        return new Promise(function(resolve, reject) {
            $.post("/saveSettings"+window.location.search, {newSettingsData: newSettingsData, _csrf: $("[name='_csrf']").val()}, function(data) {
                $("#saveSettingsModal").modal("hide")
                if(data.success == false) reject()
                resolve(l.stop())
            })
        }).then(function() {
            // Alert success and re-disable button
            return new Promise(function(resolve, reject) {
                resolve(showAlert(true))
            })
        }).catch(function() {
            // Error saving data.
            showAlert(false)
        })
            
    })
    
    function showAlert(success) {
        clicked = false
        $("#saveSettings").prop("disabled", true)
        $(".cancelButton").prop("disabled", false)
        $(".alert").removeClass((success == true ? "alert-error" : "alert-success"))
            .addClass((success == true ? "alert-success" : "alert-danger"))
            .html((success == true ? "<strong>Settings saved!</strong>" : "<strong>Error saving data:</strong> Woops! Something went wrong!"))
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
    
    // Don't save changes and re-enable clicking on the nav links
    $(".cancelButton").click(function() {
        $("#navbar ul li a").off("click")
        $(".settingsContainer").off("mouseleave")
        clicked = false
        $("#navbar ul li a").click(function(event) {
            if(clicked == true) event.preventDefault()
            return clicked = true
        })
    })
    

    // Trigger change on enable/disable of Default Related Products
    $("#showDefault").on('switchChange.bootstrapSwitch', function(event, state) {
        $(".form-control").trigger("change")
    })
    
    
    // Manage Subscription
    $("#manageSubscriptionButton").click(function(event) {
        $("#manageSubscriptionModal").modal('show')
    })
    
    //$("#showDefault").bootstrapSwitch('state') to get state
    
})