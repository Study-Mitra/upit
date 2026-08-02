$(function() {
            $("#contact_form").on("submit", function(e) {
                e.preventDefault();
                var formData = new FormData(this);

                $.ajax({
                    url: '/lead-submit',
                    type: 'POST',
                    data: formData,
                    cache: false,
                    contentType: false,
                    processData: false,
                    success: function(response) {
                        if (response.status === '200') {
                            Swal.fire({
                                title: 'Success!',
                                text: response.msg,
                                icon: 'success',
                                confirmButtonText: 'OK'
                            }).then(() => {
                                window.location.reload();
                            });
                        } else {
                            Swal.fire({
                                title: 'Error!',
                                text: response.msg,
                                icon: 'error',
                                confirmButtonText: 'OK'
                            });
                        }
                    },
                    error: function(xhr) {
                        Swal.fire({
                            title: 'Error!',
                            text: xhr.responseJSON?.msg ||
                                'An error occurred, please try again.',
                            icon: 'error',
                            confirmButtonText: 'OK'
                        });
                    }
                });
            });
        });