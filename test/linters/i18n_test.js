'use strict';

const assert = require('assert');
const mockFs = require('mock-fs');
const {Writable} = require('stream');

const Reporter = require('../../reporter');
const I18nLinter = require('../../linters/i18n');

describe('I18nLinter', function(){
  beforeEach(function(){
    const nullStream = new Writable;
    nullStream._write = () => {};

    this.reporter = new Reporter(nullStream);
    this.linter = new I18nLinter('/path/to/theme');
  });

  afterEach(function(){
    mockFs.restore();
  });

  describe('#testDefaultLocale', function(){
    it('reports a failure if the theme doesn\'t have a default locale', function(){
      mockFs({'/path/to/theme': {}});

      return this.linter.testDefaultLocale(this.reporter).then(() => {
        assert.equal(1, this.reporter.failures.length);
        const [message] = this.reporter.failures[0];
        assert.equal('Does not include a default locale file', message);
      });
    });

    it('reports a success if the theme has a default locale', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': '{}'
        }
      }});

      return this.linter.testDefaultLocale(this.reporter).then(() => {
        assert.equal(1, this.reporter.successes.length);
        const [message] = this.reporter.successes[0];
        assert.equal('Includes a default locale file', message);
      });
    });
  });

  describe('#testReferencedKeys', function(){
    it('reports a failure for keys in liquid that are missing from the default locale', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': '{}'
        },
        'templates': {
          'product.liquid': '{{ "product.card.title" | t }}'
        }
      }});

      return this.linter.testReferencedKeys(this.reporter).then(() => {
        assert.equal(1, this.reporter.failures.length);
        const [message] = this.reporter.failures[0];
        assert.equal("'product.card.title' does not have a matching entry in 'en.default'", message);
      });
    });

    it('reports a failure for pluralized keys in liquid that are missing from the default locale', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': '{}'
        },
        'templates': {
          'product.liquid': '{{ "product.inventory_with_count" | t: count: 1 }}'
        }
      }});

      return this.linter.testReferencedKeys(this.reporter).then(() => {
        assert.equal(1, this.reporter.failures.length);
        const [message] = this.reporter.failures[0];
        assert.equal("'product.inventory_with_count.other' does not have a matching entry in 'en.default'", message);
      });
    });

    it('reports a success for references that are present in the default locale', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': JSON.stringify({
            'product': {
              'card': {
                'title': 'Product title'
              }
            }
          })
        },
        'templates': {
          'product.liquid': '{{ "product.card.title" | t }}'
        }
      }});

      return this.linter.testReferencedKeys(this.reporter).then(() => {
        assert.equal(1, this.reporter.successes.length);
        const [message] = this.reporter.successes[0];
        assert.equal("'product.card.title' has a matching entry in 'en.default'", message);
      });
    });

    it('reports a success for pluralized references that are present in the default locale', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': JSON.stringify({
            'product': {
              'inventory_with_count': {
                'other': '{{ count }} products'
              }
            }
          })
        },
        'templates': {
          'product.liquid': '{{ "product.inventory_with_count" | t: count: 1 }}'
        }
      }});

      return this.linter.testReferencedKeys(this.reporter).then(() => {
        assert.equal(1, this.reporter.successes.length);
        const [message] = this.reporter.successes[0];
        assert.equal("'product.inventory_with_count.other' has a matching entry in 'en.default'", message);
      });
    });
  });

  describe('#testMismatchedKeys', function(){
    it('reports a failure for keys present in the default locale but not others', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': JSON.stringify({'hello': 'Hello!', 'bye': 'Bye!'}),
          'fr.json': '{}'
        }
      }});

      return this.linter.testMismatchedKeys(this.reporter).then(() => {
        assert.equal(1, this.reporter.failures.length);
        const [message, file] = this.reporter.failures[0];
        assert.equal('/path/to/theme/locales/fr.json', file);
        assert.equal("Mismatching entries found\nmissing: 'hello', 'bye'", message);
      });
    });

    it('reports a failure for keys not present in the default locale but present in others', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': '{}',
          'fr.json': JSON.stringify({'hello': 'Bonjour!', 'bye': 'Au revoir!'})
        }
      }});

      return this.linter.testMismatchedKeys(this.reporter).then(() => {
        assert.equal(1, this.reporter.failures.length);
        const [message, file] = this.reporter.failures[0];
        assert.equal('/path/to/theme/locales/fr.json', file);
        assert.equal("Mismatching entries found\nextra: 'hello', 'bye'", message);
      });
    });

    it('reports a success if all keys match', function(){
      mockFs({'/path/to/theme': {
        'locales': {
          'en.default.json': JSON.stringify({'hello': 'Hello!', 'bye': 'Bye!'}),
          'fr.json': JSON.stringify({'hello': 'Bonjour!', 'bye': 'Au revoir!'})
        }
      }});

      return this.linter.testMismatchedKeys(this.reporter).then(() => {
        assert.equal(1, this.reporter.successes.length);
        const [message, file] = this.reporter.successes[0];
        assert.equal('/path/to/theme/locales/fr.json', file);
        assert.equal("'fr' has all the entries present in 'en.default'", message);
      });
    });
  });
});
