$(document).ready(function(){
    $(".form-signin").submit(function(event) {
        var input = $("input:first").val()

        if( input.indexOf(".myshopify.com") !== -1 ) {
            var shopname = input.replace(".myshopify.com", "")
            window.location.assign("/install?shop="+encodeURIComponent(shopname))
            event.preventDefault()
            return
        }
        
        $("#errorMessage").css("opacity", 1);
        setTimeout(function(){
            $("#errorMessage").animate({
                opacity: 0,
                visibility: "invisible"
            }, 300)
        }, 2000)
        
        event.preventDefault()
    })
})