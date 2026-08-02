$('.owl-carousel-logo').owlCarousel({
            loop: true,
            margin: 10,
            autoplay: true,
            // autoplayTimeout: 5000,
            // autoplaySpeed: 5000, 
            // smartSpeed: 5000, 
            center: true,
            animateOut: 'owl-stage',
            lazyLoad: false,
            responsiveClass: true,
            responsive: {
                0: {
                    items: 1,
                    nav: false,
                    dots: false,
                },
                600: {
                    items: 3,
                    nav: false
                },
                1000: {
                    items: 4,
                    nav: false,
                    dots: false,
                }
            }
        });