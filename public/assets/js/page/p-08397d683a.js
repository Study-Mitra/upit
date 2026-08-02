// function compareNowModal() {
        //     var course_id = $('#course_id').val();
        //     var university_id = $('#set_university_card_first').val();
        //     var university_id_sec = $('#set_university_card_sec').val();
        //     var university_id_third = $('#set_university_card_third').val();


        //     if (!course_id) {
        //         $('#error-msg-cour').text('*Select Course').show();
        //     }
        //     if (!university_id) {
        //         $('#error-msg-first').text('*Select University').show();
        //     }
        //     if (!university_id_sec) {
        //         $('#error-msg-sce').text('*Select University').show();
        //     }
        //     if (!university_id_third) { 
        //         $('#error-msg-third').text('*Select University').show(); 
        //     } else {
        //         $('#pop').modal('show');
        //     }

        // }

        function GetOpt() {
            $.ajax({
                url: 'https://countriesnow.space/api/v0.1/countries/state/cities',
                dataType: 'json',
                type: 'POST',
                data: {
                    'country': 'India',
                    'state': state
                },
            });
        }


        function compareNowModal() {
            var course_id = $('#course_id').val();
            var subCourseId = $('#set_subcourse').val();
            var university_id = $('#set_university_card_first').val();
            var university_id_sec = $('#set_university_card_sec').val();
            var university_id_third = $('#set_university_card_third').val();

            $('#error-msg-cour').text('').hide();
            $('#error-msg-first').text('').hide();
            $('#error-msg-sce').text('').hide();
            $('#error-msg-third').text('').hide();

            var isValid = true;

            if (!course_id) {
                $('#error-msg-cour').text('*Select Course').show();
                isValid = false;
            }
            if (!university_id) {
                $('#error-msg-first').text('*Select University').show();
                isValid = false;
            }
            if (!university_id_sec) {
                $('#error-msg-sce').text('*Select University').show();
                isValid = false;
            }


            if (isValid) {
                $('#pop').modal('show');
            }
        }


        function compareNows() {
            var university_id = $('#set_university_card_first').val();
            var university_id_sec = $('#set_university_card_sec').val();
            var university_id_third = $('#set_university_card_third').val();
            var subCourseId = $('#set_subcourse').val();

            $.ajax({
                url: '/get-uni-slug',
                type: 'get',
                data: {
                    university_id: university_id,
                    university_id_sec: university_id_sec,
                    university_id_third: university_id_third,
                    sub_course_id: subCourseId

                },
                beforeSend: function() {
                    $('#loder').modal('show');
                },
                success: function(response) {
                    if (response.status == 200) {
                        let compareUrl = "/compare/" + response.universities.join("/");
                        window.location.href = compareUrl;
                    } else {
                        Toastify({
                            text: data.msg,
                            duration: 1500,
                            style: {
                                background: "linear-gradient(111.4deg, rgb(246, 4, 26) 0.4%, rgb(251, 139, 34) 100.2%)",
                            }
                        }).showToast();
                    }

                },

            });
        }

        function getSubcourse(id) {

            $.ajax({
                url: '/get-sub-courses',
                type: 'get',
                data: {
                    course_id: id
                },
                success: function(response) {
                    if (response.status == 200) {
                        let options = '<option value="" disabled selected>Select Sub Course</option>';

                        // Generate the options for sub-courses
                        $.each(response.subCourses, function(key, val) {
                            options += `<option value="${val.id}">${val.name}</option>`;
                        });

                        // Set the generated options to the dropdown
                        $('#set_subcourse').html(options);
                        $('#set_subcourse').removeClass('d-none');


                    }
                    console.log("Data sent!");
                },
                complete: function() {
                    getUniversities();
                }
            });
        }

        function getUniversities() {
            var id = $('#course_id').val();
            var subCourseId = $('#set_subcourse').val();
            $.ajax({
                url: '/get-universities',
                type: 'get',
                data: {
                    course_id: id,
                    sub_course_id: subCourseId

                },
                success: function(response) {
                    if (response.status == 200) {
                        let options = '<option value="" disabled selected>Select Your university </option>';
                        $.each(response.universities, function(key, val) {
                            options += `<option value="${val.id}">${val.name}</option>`;
                        });

                        $('#set_university_card_first').html(options);
                        $('#set_university_card_sec').html(options);
                        $('#set_university_card_third ').html(options);

                        $('#uni_first_image').hide();
                        $('#uni_sec_image').hide();
                        $('#uni_third_image').hide();
                        $('#uni_first_icon_container').css('display', 'flex');
                        $('#uni_sec_icon_container').css('display', 'flex');
                        $('#uni_third_icon_container').css('display', 'flex');
                    }
                }
            });
        }
        $('#set_university_card_first').on('change', function() {
            var university_id = $('#set_university_card_first').val();
            var university_id_sec = $('#set_university_card_sec').val();
            var university_id_third = $('#set_university_card_third').val();
            var subCourseId = $('#set_subcourse').val();
            var course_id = $('#course_id').val();
            $.ajax({
                url: '/change-compare-university',
                type: 'get',
                data: {
                    university_id: university_id,
                    university_id_sec: university_id_sec,
                    university_id_third: university_id_third,
                    course_id: course_id,
                    sub_course_id: subCourseId
                },
                success: function(response) {
                    if (response.status == 200) {
                        console.log(response.uni_first)
                        if (response.uni_first && response.uni_first.logo) {
                            $('#uni_first_icon_container').hide();
                            $('#uni_first_image').attr('src', '/' + response.uni_first.logo).show();
                        } else {
                            $('#uni_first_image').hide();
                            $('#uni_first_icon_container').css('display', 'flex');
                        }
                        if (response.uni_third && response.uni_sec) {
                            let optionsSecond = '<option value="" disabled>Select Your University</option>';
                            $.each(response.university_sec, function(key, val) {
                                optionsSecond +=
                                    `<option value="${val.id}" ${response.uni_sec.id == val.id ? 'selected' : ''}>${val.name}</option>`;
                            });
                            $('#set_university_card_sec').html(optionsSecond);

                            let optionThird =
                                '<option value="" disabled selected>Select Your University</option>';
                            $.each(response.university_third, function(key, val) {
                                optionThird +=
                                    `<option value="${val.id}" ${response.uni_third.id == val.id ? 'selected' : ''}>${val.name}</option>`;
                            });
                            $('#set_university_card_third').html(optionThird);
                        } else {
                            let options =
                                '<option value="" disabled selected>Select Your University</option>';
                            $.each(response.universities, function(key, val) {
                                options += `<option value="${val.id}">${val.name}</option>`;
                            });
                            $('#set_university_card_sec').html(options);

                            $('#uni_sec_image').hide();
                            $('#uni_sec_icon_container').css('display', 'flex');
                        }
                    }
                }
            });
        });
        $('#set_university_card_sec').on('change', function() {
            var university_id_frst = $('#set_university_card_first').val();
            var university_id_sec = $('#set_university_card_sec').val();
            var course_id = $('#course_id').val();
            var subCourseId = $('#set_subcourse').val();

            $.ajax({
                url: '/change-compare-university',
                type: 'get',
                data: {
                    university_id_frst: university_id_frst,
                    university_id_sec: university_id_sec,
                    course_id: course_id,
                    sub_course_id: subCourseId
                },
                success: function(response) {
                    if (response.status == 200) {
                        if (response.uni_sec && response.uni_sec.logo) {
                            $('#uni_sec_icon_container').hide();
                            $('#uni_sec_image').attr('src', '/' + response.uni_sec.logo).show();
                        } else {
                            $('#uni_sec_image').hide();
                            $('#uni_sec_icon_container').css('display', 'flex');
                        }
                        let optionsFirst =
                            '<option value="" disabled selected>Select Your University</option>';

                        $.each(response.university_frst, function(key, val) {
                            optionsFirst +=
                                `<option value="${val.id}" ${response.uni_first.id == val.id ? 'selected': ''}>${val.name}</option>`;
                        });
                        $('#set_university_card_first').html(optionsFirst);

                        let optionsSecond =
                            '<option value="" disabled selected>Select Your University</option>';
                        $.each(response.university_third, function(key, val) {
                            optionsSecond += `<option value="${val.id}">${val.name}</option>`;
                        });
                        $('#set_university_card_third').html(optionsSecond);

                        $('#uni_third_image').hide();
                        $('#uni_third_icon_container').css('display', 'flex');
                    }
                }
            });
        });
        $('#set_university_card_third').on('change', function() {
            var university_id_frst = $('#set_university_card_first').val();
            var university_id_sec = $('#set_university_card_sec').val();
            var university_id_third = $('#set_university_card_third').val();
            var course_id = $('#course_id').val();
            var subCourseId = $('#set_subcourse').val();
            $.ajax({
                url: '/change-compare-university',
                type: 'get',
                data: {
                    university_id_frst: university_id_frst,
                    university_id_sec: university_id_sec,
                    university_id_third: university_id_third,
                    course_id: course_id,
                    sub_course_id: subCourseId
                },
                success: function(response) {
                    if (response.status === 200) {
                        if (response.uni_third && response.uni_third.logo) {
                            $('#uni_third_icon_container').hide();
                            $('#uni_third_image').attr('src', '/' + response.uni_third.logo).show();
                        } else {
                            $('#uni_third_image').hide();
                            $('#uni_third_icon_container').css('display', 'flex');
                        }

                        // Update first dropdown
                        let optionsFirst = '<option value="" disabled>Select Your University</option>';
                        $.each(response.university_first, function(key, val) {
                            optionsFirst +=
                                `<option value="${val.id}" ${response.uni_first.id == val.id ? 'selected' : ''}>${val.name}</option>`;
                        });
                        $('#set_university_card_first').html(optionsFirst);

                        // Update second dropdown
                        let optionsSecond = '<option value="" disabled>Select Your University</option>';
                        $.each(response.university_sec, function(key, val) {
                            optionsSecond +=
                                `<option value="${val.id}" ${response.uni_sec.id == val.id ? 'selected' : ''}>${val.name}</option>`;
                        });
                        $('#set_university_card_sec').html(optionsSecond);
                    }
                }
            });
        });