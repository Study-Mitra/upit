// Course Filter
    function FilterCourse(el) {
        let courseId = el.value;

        // Hide all subcourse containers and empty them
        document.querySelectorAll('.subcourses-container').forEach(function(container) {
            container.style.display = 'none';
            container.innerHTML = '';
        });

        // Show the active container
        let activeContainer = document.getElementById('subcourses-container-' + courseId);
        if (activeContainer) {
            activeContainer.style.display = 'block';
            activeContainer.innerHTML = '<div class="subcourse-loading" style="font-size: 11px; color: #a0aec0; margin: 6px 0;"><i class="fas fa-spinner fa-spin"></i> Loading specializations...</div>';

            // Load subcourses
            $.ajax({
                url: "/get-sub-courses",
                type: "GET",
                data: { course_id: courseId },
                success: function(response) {
                    if (response.status == 200 && response.subCourses.length > 0) {
                        let html = '';
                        response.subCourses.forEach(function(sub) {
                            let displayName = sub.name.includes(' in ') ? sub.name.substring(sub.name.lastIndexOf(' in ') + 4) : sub.name;
                            html += `
                                <div class="subcourse-row">
                                    <input id="subcourse-${sub.id}" type="radio" name="sub_course_filter" value="${sub.id}" onchange="FilterSubcourse()">
                                    <label for="subcourse-${sub.id}">${displayName}</label>
                                </div>
                            `;
                        });
                        activeContainer.innerHTML = html;
                    } else {
                        activeContainer.innerHTML = '<div class="subcourse-loading" style="font-size: 11px; color: #a0aec0; margin: 6px 0;">No specializations available</div>';
                    }
                }
            });
        }

        // Filter Universities by Course
        $.ajax({
            url: "/filter-course",
            type: "GET",
            data: { course_id: courseId },
            success: function(response) {
                $('#university-list').html(response);
                $('#university_count').text($('#university-list .rbt-card').length);
            }
        });
    }

    // Subcourse Filter
    function FilterSubcourse() {
        let subCourseId = document.querySelector('input[name="sub_course_filter"]:checked')?.value;
        if (!subCourseId) return;

        $.ajax({
            url: "/filter-course",
            type: "GET",
            data: { sub_course_id: subCourseId },
            success: function(response) {
                $('#university-list').html(response);
                $('#university_count').text($('#university-list .rbt-card').length);
            }
        });
    }

    // Mode Filter
    function filterModyStudy() {
        let mode_id = document.querySelector('input[name="mode_filter"]:checked')?.value;
        if (!mode_id) return;

        $.ajax({
            url: "/filter-mode-study",
            type: 'GET',
            data: { mode_id: mode_id },
            success: function(response) {
                $('#university-list').html(response.html);
                $('#university_count').text(response.count);
            }
        });
    }

    // Price Filter
    function filterPrice(id) {
        $.ajax({
            url: "/filter-price",
            type: 'GET',
            data: { price: id },
            success: function(response) {
                $('#university-list').html(response.html);
                $('#university_count').text(response.count);
            }
        });
    }

    // Brochure Download
    function downloadBrochure(url, name) {
        $('#pop').modal('show');
        $('#pop #student-submit-form').on('click', function() {
            var link = document.createElement("a");
            url = '/' + url;
            link.download = name;
            link.href = url;
            link.click();
            link.remove();
        });
    }

    // Compare Now
    function compareNow() {
        if (university_id.length < 2) {
            alert("Please add at least 2 universities to compare");
            return;
        }

        $.ajax({
            url: '/get-uni-slug',
            type: 'get',
            data: {
                university_id: university_id[0] ?? null,
                university_id_sec: university_id[1] ?? null,
                university_id_third: university_id[2] ?? null,
                sub_course_id: $('#set_subcourse').val()
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
                        text: response.msg,
                        duration: 1500,
                        style: {
                            background: "linear-gradient(111.4deg, rgb(246, 4, 26) 0.4%, rgb(251, 139, 34) 100.2%)",
                        }
                    }).showToast();
                }
            }
        });
    }