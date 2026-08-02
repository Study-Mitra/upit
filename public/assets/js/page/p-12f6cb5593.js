function downloadBrochure(url, name) {
            $('#pop').modal('show');
            $('#pop #student-submit-form').on('click', function() {
                var link = document.createElement("a");
                url = '/' + url;
                link.download = name;
                link.href = url;
                link.click();
                link.remove();
            })
        }