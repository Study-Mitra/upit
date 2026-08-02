
    window.onscroll = function() {
        if (window.scrollY >= 77) {
            $('.header_section').removeClass('floating-menu').addClass('sticky-top');
        } else {
            $('.header_section').addClass('floating-menu').removeClass('sticky-top');
        }
    };
