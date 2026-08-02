
    $(document).ready(function() {
        var loaderTimeout = setTimeout(function() {
            $('#remove_loader').fadeOut();
        }, 2000);


        $('.course-filter').on('change', function() {
            let selectedCourses = [];
            $('.course-filter:checked').each(function() {
                selectedCourses.push($(this).val());
            });

            $('.uni-card').each(function() {
                let courses = $(this).data('courses').split(',');
                let showUniversity = selectedCourses.some(courseId => courses.includes(
                    courseId));

                if (selectedCourses.length === 0 || showUniversity) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });
    });
