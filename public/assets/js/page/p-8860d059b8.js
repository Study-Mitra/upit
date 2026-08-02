document.querySelectorAll('#rbt-myTab .nav-link').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#rbt-myTab .nav-link').forEach(function(b) {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
        });
    });