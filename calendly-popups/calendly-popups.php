<?php
/**
 * Plugin Name: Calendly Popups (Awesome Love Creation)
 * Description: Stellt einen Shortcode [calendly_popups] bereit, lädt die offizielle Calendly-Widget-Bibliothek, blendet unten rechts einen Hover-Button (Sprechblase) mit dem Profil-Link ein und öffnet vier vordefinierte Buchungsstrecken als Popup, sobald ein Element mit der passenden Klasse geklickt wird.
 * Version: 1.0.0
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
    );

    private $profile_url = 'https://calendly.com/awesomelovecreation';
    private $accent      = '#a39587';
    private $radius      = '30px';

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

        wp_register_script( self::HANDLE_APP, '', array( self::HANDLE_JS ), '1.0.0', true );
    }

    public function shortcode( $atts ) {
        $atts = shortcode_atts(
            array(
                'badge'       => 'Termin buchen',
                'badge_text'  => 'Termin vereinbaren',
                'profile_url' => $this->profile_url,
                'accent'      => $this->accent,
                'radius'      => $this->radius,
                'text_color'  => '#ffffff',
            ),
            $atts,
            'calendly_popups'
        );

        wp_enqueue_style( self::HANDLE_CSS );
        wp_enqueue_script( self::HANDLE_JS );
        wp_enqueue_script( self::HANDLE_APP );

        $config = array(
            'links'      => $this->links,
            'profileUrl' => esc_url_raw( $atts['profile_url'] ),
            'badgeText'  => wp_strip_all_tags( $atts['badge_text'] ),
            'accent'     => sanitize_hex_color( $atts['accent'] ) ? $atts['accent'] : $this->accent,
            'textColor'  => sanitize_hex_color( $atts['text_color'] ) ? $atts['text_color'] : '#ffffff',
            'radius'     => preg_match( '/^\d+(px|%|em|rem)$/', $atts['radius'] ) ? $atts['radius'] : $this->radius,
        );

        $inline_css = sprintf(
            '.calendly-badge-widget .calendly-badge-content{background-color:%1$s !important;color:%2$s !important;border-radius:%3$s !important;box-shadow:0 4px 14px rgba(0,0,0,0.15) !important;font-weight:600;}',
            $config['accent'],
            $config['textColor'],
            $config['radius']
        );

        wp_add_inline_style( self::HANDLE_CSS, $inline_css );

        $inline_js = 'window.ALCCalendly = ' . wp_json_encode( $config ) . ';' . "\n" . $this->bootstrap_js();
        wp_add_inline_script( self::HANDLE_APP, $inline_js );

        return '<!-- Calendly Popups initialisiert -->';
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

        waitForCalendly(function () {
            if (cfg.profileUrl && window.Calendly.initBadgeWidget) {
                window.Calendly.initBadgeWidget({
                    url: cfg.profileUrl,
                    text: cfg.badgeText || 'Termin vereinbaren',
                    color: cfg.accent,
                    textColor: cfg.textColor,
                    branding: false
                });
            }
        });

        document.addEventListener('click', function (e) {
            var el = e.target.closest('[data-calendly], .calendly-deeptalk, .calendly-reconnect, .calendly-lovejourney, .calendly-lovetrip');
            if (!el) return;

            var key = (el.getAttribute('data-calendly') || '').toLowerCase();
            if (!key) {
                if (el.classList.contains('calendly-deeptalk')) key = 'deeptalk';
                else if (el.classList.contains('calendly-reconnect')) key = 'reconnect';
                else if (el.classList.contains('calendly-lovejourney')) key = 'lovejourney';
                else if (el.classList.contains('calendly-lovetrip')) key = 'lovetrip';
            }

            var url = links[key];
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
