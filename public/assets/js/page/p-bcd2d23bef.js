document.addEventListener('DOMContentLoaded', function () {
            const lightbox = GLightbox({
                selector: '.glightbox',
                touchNavigation: true,
                loop: true,
                zoomable: true,
                draggable: true,
                openEffect: 'zoom',
                closeEffect: 'fade',
                slideEffect: 'slide'
            });
        });