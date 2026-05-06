<?php
/**
 * Plugin Name: Calendly Popups (Awesome Love Creation)
 * Description: Stellt einen Shortcode [calendly_popups] bereit, lädt die offizielle Calendly-Widget-Bibliothek, blendet unten rechts einen kleinen quadratischen Logo-Button (15px Border-Radius) ein, der das Profil als Popup öffnet, und triggert fünf vordefinierte Buchungsstrecken (Deeptalk, Reconnect, LoveJourney, Lovetrip, Clarity), sobald ein Element mit der passenden Klasse geklickt wird.
 * Version: 1.1.0
 * Author: Awesome Love Creation
 * License: GPLv2 or later
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class ALC_Calendly_Popups {

    const HANDLE_CSS = 'calendly-widget-css';
    const HANDLE_JS  = 'calendly-widget-js';
    const HANDLE_APP = 'alc-calendly-popups';

    private $links = array(
        'deeptalk'    => 'https://calendly.com/awesomelovecreation/60min',
        'reconnect'   => 'https://calendly.com/awesomelovecreation/reconnect',
        'lovejourney' => 'https://calendly.com/awesomelovecreation/lovejourney',
        'lovetrip'    => 'https://calendly.com/awesomelovecreation/lovetrip',
        'clarity'     => 'https://calendly.com/awesomelovecreation/20min',
    );

    private $profile_url = 'https://calendly.com/awesomelovecreation';
    private $accent      = '#a39587';
    private $radius      = '15px';
    private $size        = '56px';

    public function __construct() {
        add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );
        add_shortcode( 'calendly_popups', array( $this, 'shortcode' ) );
    }

    public function register_assets() {
        wp_register_style(
            self::HANDLE_CSS,
            'https://assets.calendly.com/assets/external/widget.css',
            array(),
            null
        );

        wp_register_script(
            self::HANDLE_JS,
            'https://assets.calendly.com/assets/external/widget.js',
            array(),
            null,
            true
        );

        wp_register_script( self::HANDLE_APP, '', array( self::HANDLE_JS ), '1.1.0', true );
    }

    public function shortcode( $atts ) {
        $atts = shortcode_atts(
            array(
                'profile_url' => $this->profile_url,
                'accent'      => $this->accent,
                'radius'      => $this->radius,
                'size'        => $this->size,
                'logo'        => '',
                'alt'         => 'Termin buchen',
            ),
            $atts,
            'calendly_popups'
        );

        wp_enqueue_style( self::HANDLE_CSS );
        wp_enqueue_script( self::HANDLE_JS );
        wp_enqueue_script( self::HANDLE_APP );

        $accent = sanitize_hex_color( $atts['accent'] ) ? $atts['accent'] : $this->accent;
        $radius = preg_match( '/^\d+(px|%|em|rem)$/', $atts['radius'] ) ? $atts['radius'] : $this->radius;
        $size   = preg_match( '/^\d+(px|em|rem)$/', $atts['size'] ) ? $atts['size'] : $this->size;
        $logo   = esc_url( $atts['logo'] );
        $alt    = wp_strip_all_tags( $atts['alt'] );

        $config = array(
            'links'      => $this->links,
            'profileUrl' => esc_url_raw( $atts['profile_url'] ),
        );

        $inline_css = sprintf(
            '.alc-calendly-bubble{position:fixed;right:20px;bottom:20px;width:%1$s;height:%1$s;border-radius:%2$s;background-color:%3$s;border:none;padding:0;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;overflow:hidden;z-index:9998;transition:transform .15s ease, box-shadow .15s ease;}'
            . '.alc-calendly-bubble:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.22);}'
            . '.alc-calendly-bubble:focus{outline:2px solid %3$s;outline-offset:2px;}'
            . '.alc-calendly-bubble img{width:70%%;height:70%%;object-fit:contain;display:block;}'
            . '.alc-calendly-bubble .alc-calendly-bubble-fallback{width:55%%;height:55%%;color:#fff;}',
            $size,
            $radius,
            $accent
        );

        wp_add_inline_style( self::HANDLE_CSS, $inline_css );

        $inline_js = 'window.ALCCalendly = ' . wp_json_encode( $config ) . ';' . "\n" . $this->bootstrap_js();
        wp_add_inline_script( self::HANDLE_APP, $inline_js );

        $icon = $logo
            ? '<img src="' . esc_url( $logo ) . '" alt="' . esc_attr( $alt ) . '" />'
            : '<svg class="alc-calendly-bubble-fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

        $button = sprintf(
            '<button type="button" class="alc-calendly-bubble" data-calendly-profile aria-label="%s">%s</button>',
            esc_attr( $alt ),
            $icon
        );

        return $button;
    }

    private function bootstrap_js() {
        return <<<'JS'
(function () {
    function ready(fn) {
        if (document.readyState !== 'loading') { fn(); }
        else { document.addEventListener('DOMContentLoaded', fn); }
    }

    function waitForCalendly(cb, tries) {
        tries = tries || 0;
        if (window.Calendly && typeof window.Calendly.initPopupWidget === 'function') {
            cb();
        } else if (tries < 50) {
            setTimeout(function () { waitForCalendly(cb, tries + 1); }, 100);
        }
    }

    ready(function () {
        var cfg = window.ALCCalendly || {};
        var links = cfg.links || {};

        document.addEventListener('click', function (e) {
            var el = e.target.closest('[data-calendly-profile], [data-calendly], .calendly-deeptalk, .calendly-reconnect, .calendly-lovejourney, .calendly-lovetrip, .calendly-clarity');
            if (!el) return;

            var url = null;

            if (el.hasAttribute('data-calendly-profile')) {
                url = cfg.profileUrl;
            } else {
                var key = (el.getAttribute('data-calendly') || '').toLowerCase();
                if (!key) {
                    if (el.classList.contains('calendly-deeptalk')) key = 'deeptalk';
                    else if (el.classList.contains('calendly-reconnect')) key = 'reconnect';
                    else if (el.classList.contains('calendly-lovejourney')) key = 'lovejourney';
                    else if (el.classList.contains('calendly-lovetrip')) key = 'lovetrip';
                    else if (el.classList.contains('calendly-clarity')) key = 'clarity';
                }
                url = links[key];
            }

            if (!url) return;

            e.preventDefault();
            waitForCalendly(function () {
                window.Calendly.initPopupWidget({ url: url });
            });
        });
    });
})();
JS;
    }
}

new ALC_Calendly_Popups();
