document.addEventListener('DOMContentLoaded', function() {
            var slideCount = document.querySelectorAll('.coursesSwiper .swiper-slide').length;
            var coursesSwiper = new Swiper('.coursesSwiper', {
                slidesPerView: 1,
                spaceBetween: 20,
                loop: slideCount > 1,
                autoplay: slideCount > 1 ? {
                    delay: 3000,
                    disableOnInteraction: false,
                } : false,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: slideCount > 1 ? '.swiper-button-next' : null,
                    prevEl: slideCount > 1 ? '.swiper-button-prev' : null,
                },
                breakpoints: {
                    576: {
                        slidesPerView: Math.min(slideCount, 2),
                        spaceBetween: 20,
                    },
                    768: {
                        slidesPerView: Math.min(slideCount, 3),
                        spaceBetween: 30,
                    },
                    1024: {
                        slidesPerView: Math.min(slideCount, 4),
                        spaceBetween: 30,
                    }
                }
            });
        });