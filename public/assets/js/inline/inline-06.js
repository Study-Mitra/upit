
    $(document).ready(function() {
        $('#student-submit-form').click(function() {
            var name = $('#name_apply_now').val();
            var contact = $('#contact_apply_now').val();
            var email = $('#email_apply_now').val();
            var source = $('#source_apply_now').val();
            var state = $('#state_apply_now').val();
            var course = $('#course_apply_now').val();
            // var otp = $('#otp_apply_now').val();
            var course_id = $('#course_id').val();
            $.ajax({
                url: "/lead-submit",
                method: 'POST',

                data: {
                    "_token": "",
                    'name': name,
                    'contact': contact,
                    'email': email,
                    'source': source,
                    'state': state,
                    'course': course,
                    // 'otp': otp,
                },
                success: function(response) {
                    console.log(response);
                    if (response.status === '200') {

                        $('#pop').modal('hide');

                        Swal.fire({
                            title: "Success",
                            text: "Form submitted successfully",
                            icon: "success",
                            confirmButtonText: "OK"
                        }).then(() => {

                            let fromCompare = localStorage.getItem('from_compare');

                            if (fromCompare === '1') {
                                if (typeof CompareUniversity === 'function') {
                                    CompareUniversity();
                                } else if (typeof compareNow === 'function') {
                                    compareNow();
                                }
                            } else {
                                if (typeof compareNows === 'function') {
                                    compareNows();
                                }
                            }

                            // Clear flag
                            localStorage.removeItem('from_compare');
                        });

                    } else {
                        alert('An unexpected error occurred.');
                    }

                },
                error: function(xhr) {
                    if (xhr.status === 422) {
                        // Validation error
                        const errors = xhr.responseJSON.errors;
                        printErrorMsg(errors);
                    } else {
                        alert('An unexpected error occurred.');
                    }
                },
            });

            function printErrorMsg(errors) {
                // Clear existing error messages
                $('.text-danger').text('');
                $.each(errors, function(key, value) {
                    $(`#${key}_apply_now`).siblings('.text-danger').text(value[0]);
                });
            }
        });
    });
