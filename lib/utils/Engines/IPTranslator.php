<?php

/**
 * Created by PhpStorm.
 * @property string client_secret
 * @author domenico domenico@translated.net / ostico@gmail.com
 * Date: 02/03/15
 * Time: 12.10
 * 
 */

class Engines_IPTranslator extends Engines_AbstractEngine implements Engines_EngineInterface {

    protected $_config = array(
            'segment'     => null,
            'source'      => null,
            'target'      => null,
            'key'     => null,
    );

    public function __construct($engineRecord) {
        parent::__construct($engineRecord);
        if ( $this->engineRecord->type != "MT" ) {
            throw new Exception( "Engine {$this->engineRecord->id} is not a MT engine, found {$this->engineRecord->type} -> {$this->engineRecord->class_load}" );
        }
    }

    /**
     * @param $lang
     *
     * @return mixed
     * @throws Exception
     */
    protected function _fixLangCode( $lang ) {

        $acceptedLangs = array( "En", "Fr", "De", "Pt", "Es", "Ja", "ZhCn", "ZhTw", "Ru", "Ko" );

        if( $lang == 'zh-CN' ) $lang = "ZhCn"; //chinese zh-CHS simplified
        if( $lang == 'zh-TW' ) $lang = "ZhTw"; //chinese zh-CHT traditional

        $l = explode( "-", ucfirst( trim( $lang ) ) );

        if( !in_array( $l[0], $acceptedLangs ) ){
            throw new Exception( "Language Not Supported", -1 );
        }

        return $l[0];

    }

    /**
     * @param $rawValue
     *
     * @return array
     */
    protected function _decode( $rawValue ){

        $all_args =  func_get_args();

        if( is_string( $rawValue ) ) {

            $all_args[0] = json_decode( $all_args[0] , true );

            $decoded = json_decode( $rawValue, true );

            $decoded = array(
                    'data' => array(
                            "translations" => array(
                                    array( 'translatedText' => $decoded['text'][0] )
                            )
                    )
            );

        } else {
            $decoded = $rawValue; // already decoded in case of error
        }

        $mt_result = new Engines_Results_MT( $decoded );

        if ( $mt_result->error->code < 0 ) {
            $mt_result = $mt_result->get_as_array();
            $mt_result['error'] = (array)$mt_result['error'];
            return $mt_result;
        }

        $mt_match_res = new Engines_Results_MyMemory_Matches(
                $all_args[0][ 'text' ][0],
                $mt_result->translatedText,
                100 - $this->getPenalty() . "%",
                "MT-" . $this->getName(),
                date( "Y-m-d" )
        );

        $mt_res = $mt_match_res->get_as_array();

        return $mt_res;

    }

    public function get( $_config ) {

        try {
            $_config[ 'source' ] = $this->_fixLangCode( $_config[ 'source' ] );
            $_config[ 'target' ] = $this->_fixLangCode( $_config[ 'target' ] );
        } catch ( Exception $e ){
            return array(
                    'error' => array( "message" => $e->getMessage(), 'code' => $e->getCode() )
            );
        }

        $parameters = array();
        $parameters['input'] = array( $_config[ 'segment' ] );
        $parameters['from'] = $_config[ 'source' ];
        $parameters['to'] = $_config[ 'target' ];

        if (  $this->client_secret != '' && $this->client_secret != null ) {
            $parameters[ 'key' ] = $this->client_secret;
        }

        $this->_setAdditionalCurlParams( array(
                        CURLOPT_HTTPHEADER     => array(
                                "Content-Type: application/json"
                        ),
                        CURLOPT_SSL_VERIFYPEER => false,
                        CURLOPT_TIMEOUT        => 10,
                        CURLOPT_POST       => true,
                        CURLOPT_POSTFIELDS => json_encode( $parameters )
                )
        );

		$this->call( "translate_relative_url", array(), true );

        return $this->result;

    }

    public function set( $_config ) {

        //if engine does not implement SET method, exit
        return true;
    }

    public function update( $config ) {

        //if engine does not implement UPDATE method, exit
        return true;
    }

    public function delete( $_config ) {

        //if engine does not implement DELETE method, exit
        return true;

    }


}