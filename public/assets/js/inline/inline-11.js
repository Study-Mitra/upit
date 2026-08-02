
    (function () {
        var headerEl = document.querySelector('.rbt-header .rbt-header-wrapper.header-sticky');
        var placeholder = document.querySelector('.rbt-header .rbt-sticky-placeholder');
        if (!headerEl) return;

        var triggerOffset = 0;
        var headerHeight = 0;
        var isStuck = false;

        function measure() {
            // Capture trigger point relative to document, and current header height
            if (!isStuck) {
                var rect = headerEl.getBoundingClientRect();
                triggerOffset = rect.top + window.scrollY;
                headerHeight = headerEl.offsetHeight;
            }
        }

        function onScroll() {
            var y = window.scrollY || document.documentElement.scrollTop;
            if (!isStuck && y > triggerOffset + 10) {
                isStuck = true;
                headerEl.classList.add('is-stuck');
                if (placeholder) {
                    placeholder.style.height = headerHeight + 'px';
                    placeholder.classList.add('is-active');
                }
            } else if (isStuck && y <= triggerOffset) {
                isStuck = false;
                headerEl.classList.remove('is-stuck');
                if (placeholder) {
                    placeholder.style.height = '';
                    placeholder.classList.remove('is-active');
                }
            }
        }

        // Initial measurement (after layout settles)
        window.addEventListener('load', measure);
        window.addEventListener('resize', function () {
            // recompute when not currently stuck
            if (!isStuck) measure();
        }, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });

        measure();
        onScroll();
    })();
