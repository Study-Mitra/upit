
    function isNumberKey(evt) {
        var charCode = (evt.which) ? evt.which : evt.keyCode
        return !(charCode > 31 && (charCode < 48 || charCode > 57));
    }

    function isNotNumberKey(evt) {
        var charCode = (evt.which) ? evt.which : evt.keyCode
        return (charCode > 31 && (charCode < 48 || charCode > 57));
    }
