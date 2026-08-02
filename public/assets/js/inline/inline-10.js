
    $(document).ready(function() {
        $('#bannerSearch').on('input', function() {
            let searchVal = $(this).val();
            console.log(searchVal);
            $.ajax({
                type: 'GET',
                url: '/getSearchResults',
                data: {
                    search_val: searchVal
                },
                success: function(data) {
                    $('#resultDiv').html(data).removeClass('d-none');

                }
            })
        });
    })
