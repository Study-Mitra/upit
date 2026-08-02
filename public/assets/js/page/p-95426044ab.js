$('.ck_content table').addClass('table table-striped table-bordered');

        $('.ck_content table').each(function() {

            $(this).wrapAll('<div class="table-responsive"</div>');

        });
        $('.ck_content *').removeAttr('style')

        $('.ck_content img').addClass('img-fluid')