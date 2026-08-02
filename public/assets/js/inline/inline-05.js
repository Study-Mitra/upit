
    function openEnquiryModal() {
        if (compare_universities.length < 2) {
            alert("Please select at least 2 universities to compare.");
            return;
        }
        localStorage.setItem('from_compare', '1');
        $('#fullscreenModal').modal('hide');
        $('#pop').modal('show');
    }
