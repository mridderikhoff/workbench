import { value } from '../../../../helpers/src/lib/barrel';
import { shared } from '@sample/helpers';
import { other } from '../other/other';
import { internal } from '../_internal/internal';
import { component } from '@sample/widgets';
import { harness } from '@sample/widgets/testing';
import { utility } from '@sample/tools';
import { jsHelper } from '../../../../helpers/src/lib/js-helper.js';
import { missing } from './missing';
import 'external-package';
const lazy = import('../../../../helpers/src/lib/lazy');
@Component({ templateUrl: './hint.html', styleUrl: './hint.scss' })
export class Hint {
  references = [value, shared, other, internal, component, harness, utility, jsHelper, missing, lazy];
}
