let lang="en";
let pendingTopic = null;

var TxtType = function(el, toRotate, period) {
        this.toRotate = toRotate;
        this.el = el;
        this.loopNum = 0;
        this.period = parseInt(period, 10) || 2000;
        this.txt = '';
        this.tick();
        this.isDeleting = false;
    };
TxtType.prototype.tick = function() {
    var i = this.loopNum % this.toRotate.length;
    var fullTxt = this.toRotate[i];
    if (this.isDeleting) {
    this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
    this.txt = fullTxt.substring(0, this.txt.length + 1);
    }
    this.el.innerHTML = '<span class="wrap">'+this.txt+'</span>';
    var that = this;
    var delta = 100 - Math.random() * 100;
    const getRandomTwoOrFour = () => Math.random() < 0.5 ? 2 : 4;
    if (this.isDeleting) { delta /= getRandomTwoOrFour; }
    if (!this.isDeleting && this.txt === fullTxt) {
    delta = this.period;
    this.isDeleting = true;
    } else if (this.isDeleting && this.txt === '') {
    this.isDeleting = false;
    this.loopNum++;
    delta = 500;
    }
    setTimeout(function() {
    that.tick();
    }, delta);
};
let isRotating = false;

let rotateInit = function () {
    console.log("already rotating", isRotating);
    if (!isRotating) {
        var elements = document.getElementsByClassName('typewrite');
        for (var i=0; i<elements.length; i++) {
            var toRotate = elements[i].getAttribute('data-type');
            var period = elements[i].getAttribute('data-period');
            if (toRotate) {
            new TxtType(elements[i], JSON.parse(toRotate), period);
            }
        }
        var css = document.createElement("style");
        css.type = "text/css";
        css.innerHTML = ".typewrite > .wrap { border-right: 0.08em solid #fff}";
        document.body.appendChild(css);
        isRotating = true;
    }
    
}

attach_next_page_link = function() {
    $(".next_page").off().on('click','*', function() {
        let id_ = $(this).attr('id');
        let btn = $(this);
        let originalText = btn.text();
        btn.text('');
        btn.append(createDots());
        btn.css('pointer-events', 'none');
        $(".menu_inline").find('.active').removeClass('active');
        $(this).addClass('active');
        if (id_ != "1") { isRotating = false; }
        loadPage(id_).then(function() {
            document.body.scrollTop = document.documentElement.scrollTop = 0;
            if (id_ == "1") { isRotating = false; rotateInit(); }
        });
    });
}


makeActive = function(id){
    $(".menu .menu_element").each(function() {
        $(this).removeClass("active");
      });
    $("#"+id).addClass("active");
}

changeLang = (newLang) => {
    if (!["en","fr"].includes(newLang)) return;
    lang = newLang;
}
detectLang = () => {
    const userLocale = navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language;
    return userLocale.split("-")[0];
}
pages = ["","what","why","how","contact"]
loadPage = function(page){
    if (![0,1,2,3,4].includes(Number(page))) return $.Deferred().resolve().promise();
    if (window._trackPage) _trackPage(page, lang);
    let contentReady = $.ajax("html/"+lang+"/"+page+".html").done(function (reply) {
       $('#dynamic_content').html(reply);
       url_name_for_browser = pages[Number(page)];
       window.history.pushState(page,null, '#'+url_name_for_browser);
       attach_next_page_link();
       if (pendingTopic) {
           $('#topic-select').val(pendingTopic);
           pendingTopic = null;
       }
    });
    $.ajax("html/"+lang+"/menu_pop.html").done(function (reply) {
        $('#menu_pop').html(reply);
     }).then(() => {
        makeActive(page);
        attach_next_page_link();
    });
    $.ajax("html/"+lang+"/menu_inline.html").done(function (reply) {
        $('#menu_inline').html(reply);
        if(lang=="fr") {
            $('#menu_inline').addClass(lang);
        } else {
            $("#menu_inline").removeClass('fr');
        }

    }).then(() => {
        makeActive(page);
        attach_next_page_link();
    });
    return contentReady;
}

loadPageWithActiveClass = (page) => {
    loadPage(page).then(function() {
        $(".menu_inline").find('.active').removeClass('active');
        let sel = document.querySelector(".menu_inline").children;
        if (sel[Number(page)]) sel[Number(page)].classList.add("active");
        if (Number(page) == 1) { isRotating = false; rotateInit(); }
    });
}

let timeStart, timeEnd, timeDiff;
$(document).on('mouseenter','.form-box', function (event) {
    //onmousemove = function(e){console.log("mouse location:", e.clientX, e.clientY)}
    timeStart = performance.now();
}).on('mouseleave', '.form-box', function (event){
    onmousemove = "";
});

function createDots() {
    const container = document.createElement('span');
    container.className = 'dots';
    for (let i = 0; i < 3; i++) container.appendChild(document.createElement('span'));
    return container;
}

$(document).on('click','#btn', async function(e){
    const btn = this;
    const originalText = btn.textContent;
    const email = $('#mail').val().trim();
    const phone = $('#phone').val().trim();

    // validation: at least email or phone
    if (!email && !phone) {
        $('#contact-either-error').show();
        return;
    }
    $('#contact-either-error').hide();

    if (!$("#form-contact")[0].checkValidity()) {
        $("#form-contact")[0].reportValidity();
        return;
    }

    // show loading dots
    btn.disabled = true;
    btn.textContent = '';
    btn.appendChild(createDots());
    $(btn).removeClass('btn-success btn-error');

    const isFr = lang === 'fr';

    try {
        const resp = await fetch(decodeEndpoint(WORKER_ENDPOINT), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: [$('#firstname').val().trim(), $('#lastname').val().trim()].filter(Boolean).join(' '),
                email: email,
                phone: phone,
                company: $('#company') ? $('#company').val()?.trim() : '',
                topic: $('#topic-select').val(),
                message: $('#msg').val().trim()
            })
        });
        const result = await resp.json();

        if (resp.ok && result.success) {
            btn.textContent = isFr ? '✓ Merci ! Je reviens vers vous rapidement.' : '✓ Thank you! I\'ll get back to you soon.';
            $(btn).addClass('btn-success');
            $('#form-contact')[0].reset();
        } else {
            console.error('Worker error:', result);
            btn.textContent = isFr ? '✗ Échec, réessayez plus tard' : '✗ Failed, please try again later';
            $(btn).addClass('btn-error');
        }
    } catch (err) {
        console.error('Network error:', err);
        btn.textContent = isFr ? '✗ Erreur réseau, réessayez plus tard' : '✗ Network issue, please try again later';
        $(btn).addClass('btn-error');
    }

    setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
        $(btn).removeClass('btn-success btn-error');
    }, 3000);

    onmousemove = "";
    timeEnd = performance.now();
    timeDiff = timeEnd - timeStart;
});

$(document).ready( function() {
    browserLang = detectLang();
    changeLang(browserLang);
    $(window).on('popstate', function (e) {
        var state = e.originalEvent.state;
        if (state !== null) {
            isRotating = false;
            loadPageWithActiveClass(state);
        }
    });
    let current_url = new URL(window.location.href)
    if (current_url.hash){
        let hash = current_url.hash.split("#")[1];
        console.log(hash);
        let pageIndex = pages.indexOf(hash);
        console.log(pageIndex)
        loadPageWithActiveClass(pageIndex);
    } else {
        loadPage("0");
        isRotating = false;
    }
    $(".menu_inline").on('click','*', function() {
        let id_ = $(this).attr('id');
        let el = $(this);
        if (id_ != "1") { isRotating = false; }
        loadPage(id_).then(function() {
            $(".menu_inline").find('.active').removeClass('active');
            el.addClass('active');
            document.body.scrollTop = document.documentElement.scrollTop = 0;
            if (id_ == "1") { isRotating = false; rotateInit(); }
        });
    });
    $(".flags").on('click','*', function(e) {
        let id_ = $(this).attr('id');
        let newLang = id_.split("-")[1];
        changeLang(newLang);
        isRotating = false;
        loadPageWithActiveClass(window.history.state);
    });
    $(".menu_pop").off().on('click','li', function(e){
        e.preventDefault();
        let id_ = $(this).attr('id');
        if(id_ != window.history.state) {
            if(id_.includes("linkedin")) {
                window.open('https://www.Linkedin.com/in/juliengrimal','_blank');
            }
            else if (!id_.includes("lang")){
                let elId = $(this).attr('id');
                if (id_ != "1") { isRotating = false; }
                loadPage(id_).then(function() {
                    $('.menu_pop').removeClass('open');
                    $('body').removeClass('nav-open');
                    $(".menu_inline").find('.active').removeClass('active');
                    $(".menu_inline").find("#"+elId).addClass('active');
                    document.body.scrollTop = document.documentElement.scrollTop = 0;
                    if (id_ == "1") { isRotating = false; rotateInit(); }
                });
            }
            else {
                isRotating = false;
                let newLang = id_.split("-")[1];
                changeLang(newLang);
                loadPageWithActiveClass(window.history.state);
                $('.menu_pop').removeClass('open');
                $('body').removeClass('nav-open');
            }
        }
    });
    $(".menu_pop").on('click',function(e) {
        $('.menu_pop').removeClass('open');
        $('body').removeClass('nav-open');
    });
    $(".title").on('click',function() {
        isRotating = false;
        loadPage("0").then(function() {
            $(".menu_inline").find('.active').removeClass('active');
            $('.menu_pop').removeClass('open');
            $('body').removeClass('nav-open');
            document.body.scrollTop = document.documentElement.scrollTop = 0;
        });
    });
    $('.burger-toggle').on('click', function(e){
      $('body').toggleClass('nav-open');
      $('.menu_pop').toggleClass('open');
      e.preventDefault();
    });
    $(document).on('click', '.offer-card[data-topic]', function() {
        pendingTopic = $(this).data('topic');
        isRotating = false;
        loadPage("4").then(function() {
            $(".menu_inline").find('.active').removeClass('active');
            document.body.scrollTop = document.documentElement.scrollTop = 0;
        });
    });
    $(".form-box").on('mouseover', function(e){
        console.log("event is",e);
    });
    $("#form-contact").on('submit', function(e){ e.preventDefault(); });
});

//

