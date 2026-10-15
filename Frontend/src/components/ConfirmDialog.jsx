import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Deletion',
  message,
  itemName,
  confirmButtonText = 'Delete Permanently',
  isDeleting = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {message || (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-slate-900">
                    &ldquo;{itemName}&rdquo;
                  </span>
                  ? This action will remove the record from TeamSync and cannot be undone.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-slate-300 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-rose-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : confirmButtonText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.node,
  itemName: PropTypes.string,
  confirmButtonText: PropTypes.string,
  isDeleting: PropTypes.bool,
};
